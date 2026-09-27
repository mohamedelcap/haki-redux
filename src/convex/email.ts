import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Transactional email via Resend (https://resend.com).
 * Reads RESEND_API_KEY from process.env. Without the key everything is a
 * logged no-op so the app keeps working (per launch rules: fallback first).
 */

const FROM = process.env.EMAIL_FROM ?? "حكي HAKI <onboarding@resend.dev>";

type MailKind =
  | "welcome"
  | "receipt"
  | "episode"
  | "reset"
  | "challenge"
  | "manual_payment_approved";

const COLORS = {
  bg: "#0f0b08",
  card: "#1c1610",
  accent: "#F97316",
  text: "#f5f0e8",
  muted: "#a89f94",
};

function wrapHtml(title: string, bodyHtml: string, cta?: { label: string; url: string }) {
  const ctaHtml = cta
    ? `<a href="${cta.url}" style="display:inline-block;margin-top:20px;background:${COLORS.accent};color:#111;font-weight:700;padding:12px 28px;border-radius:12px;text-decoration:none">${cta.label}</a>`
    : "";
  return `<!doctype html><html dir="rtl" lang="ar"><body style="margin:0;background:${COLORS.bg};font-family:Cairo,Tahoma,sans-serif;color:${COLORS.text}">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="background:${COLORS.card};border-radius:20px;padding:32px;border:1px solid #2a2118">
      <div style="font-size:24px;font-weight:900;color:${COLORS.accent};margin-bottom:16px">حكي | HAKI</div>
      <h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
      <div style="font-size:15px;line-height:1.9;color:${COLORS.muted}">${bodyHtml}</div>
      ${ctaHtml}
      <hr style="border:none;border-top:1px solid #2a2118;margin:24px 0" />
      <p style="font-size:11px;color:#6b6157;margin:0">هذه رسالة آلية من منصة حكي الصوتية. إذا لم تتوقع هذه الرسالة تجاهلها.</p>
    </div>
  </div></body></html>`;
}

export const send = action({
  args: {
    kind: v.union(
      v.literal("welcome"),
      v.literal("receipt"),
      v.literal("episode"),
      v.literal("reset"),
      v.literal("challenge"),
      v.literal("manual_payment_approved"),
    ),
    to: v.string(),
    name: v.optional(v.string()),
    planName: v.optional(v.string()),
    amount: v.optional(v.string()),
    episodeTitle: v.optional(v.string()),
    podcastName: v.optional(v.string()),
    challengeName: v.optional(v.string()),
    code: v.optional(v.string()),
    url: v.optional(v.string()),
  },
  returns: v.object({ ok: v.boolean(), skipped: v.optional(v.boolean()) }),
  handler: async (ctx, args): Promise<{ ok: boolean; skipped?: boolean }> => {
    // Honor email preferences for opt-out kinds (reset is always sent).
    if (args.kind === "welcome" || args.kind === "receipt" || args.kind === "episode") {
      const pref = await ctx.runQuery(api.emailPrefs.getForEmail, {
        email: args.to,
        fallback: true,
      });
      if (pref) {
        if (args.kind === "welcome" && !pref.welcome) return { ok: false, skipped: true };
        if (args.kind === "receipt" && !pref.receipt) return { ok: false, skipped: true };
        if (args.kind === "episode" && !pref.episode) return { ok: false, skipped: true };
      }
    }

    const key = process.env.RESEND_API_KEY;
    if (!key) {
      console.warn("[email] RESEND_API_KEY not set — skipped send:", args.kind, args.to);
      return { ok: false, skipped: true };
    }
    const axios = (await import("axios")).default;

    let subject = "حكي | HAKI";
    let html = "";
    switch (args.kind) {
      case "welcome":
        subject = "مرحبًا بك في حكي 🎧";
        html = wrapHtml(
          `أهلًا ${args.name ?? "بك"} في حكي 🎧`,
          "حسابك جاهز الآن. تصفح آلاف الكتب الصوتية والدراما والبودكاست العربي، وابدأ استماعك من حيث توقفت عبر أجهزتك.",
          { label: "ابدأ الاستماع", url: args.url ?? "https://haki.app/" },
        );
        break;
      case "receipt":
        subject = `إيصال اشتراكك في حكي — ${args.planName ?? ""}`;
        html = wrapHtml(
          "شكرًا لاشتراكك في حكي",
          `تم تفعيل باقة <b>${args.planName ?? ""}</b>${args.amount ? ` بمبلغ ${args.amount}` : ""}. يمكنك إدارة اشتراكك في أي وقت من صفحة الاشتراكات.`,
          { label: "إدارة الاشتراك", url: args.url ?? "https://haki.app/subscriptions" },
        );
        break;
      case "episode":
        subject = `حلقة جديدة: ${args.podcastName ?? ""}`;
        html = wrapHtml(
          "حلقة جديدة من بودكاست تتابعه",
          `نزلت حلقة جديدة من «${args.podcastName ?? ""}» بعنوان «${args.episodeTitle ?? ""}». استمع الآن.`,
          { label: "استمع الآن", url: args.url ?? "https://haki.app/" },
        );
        break;
      case "reset":
        subject = "رمز استعادة كلمة المرور";
        html = wrapHtml(
          "رمز استعادة كلمة المرور",
          `رمزك هو <b style="color:${COLORS.accent};font-size:24px;letter-spacing:6px">${args.code ?? ""}</b><br/>صالح لمدة 15 دقيقة. لم تطلبه؟ تجاهل الرسالة.`,
        );
        break;
      case "challenge":
        subject = "أكملت تحديًا 🏆";
        html = wrapHtml(
          "أكملت التحدي 🏆",
          `أحسنت! أكملت تحدي «${args.challengeName ?? ""}». استمر في الاستماع لتجمع مكافآت أكثر.`,
          { label: "تصفح التحديات", url: args.url ?? "https://haki.app/challenges" },
        );
        break;
      case "manual_payment_approved":
        subject = "تم تفعيل اشتراكك 🎉";
        html = wrapHtml(
          "تم تفعيل اشتراكك 🎉",
          `باقة «${args.planName ?? ""}» مُفعّلة الآن على حسابك. استمتع بكل المحتوى المميز.`,
          { label: "ابدأ الاستماع", url: args.url ?? "https://haki.app/" },
        );
        break;
    }

    try {
      const result = await axios.post(
        "https://api.resend.com/emails",
        { from: FROM, to: [args.to], subject, html },
        { headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" } },
      );
      return { ok: !!result.data?.id };
    } catch (e) {
      console.error("[email] send failed:", e);
      return { ok: false };
    }
  },
});

/** Send an email to a user by id (reads their address + name server-side). */
export const sendToUser = action({
  args: {
    kind: v.union(
      v.literal("welcome"),
      v.literal("receipt"),
      v.literal("episode"),
      v.literal("reset"),
      v.literal("challenge"),
      v.literal("manual_payment_approved"),
    ),
    userId: v.id("users"),
    planName: v.optional(v.string()),
    amount: v.optional(v.string()),
    episodeTitle: v.optional(v.string()),
    podcastName: v.optional(v.string()),
    challengeName: v.optional(v.string()),
    code: v.optional(v.string()),
    url: v.optional(v.string()),
  },
  returns: v.object({ ok: v.boolean(), skipped: v.optional(v.boolean()) }),
  handler: async (ctx, args): Promise<{ ok: boolean; skipped?: boolean }> => {
    const user: any = await ctx.runQuery(api.account.currentUserById, { id: args.userId });
    const email = user?.email;
    if (!email) return { ok: false, skipped: true };
    return await ctx.runAction(api.email.send, {
      kind: args.kind,
      to: email,
      name: user?.name ?? undefined,
      planName: args.planName,
      amount: args.amount,
      episodeTitle: args.episodeTitle,
      podcastName: args.podcastName,
      challengeName: args.challengeName,
      code: args.code,
      url: args.url,
    });
  },
});
