import { api } from "@/convex/_generated/api";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  BadgeCheck,
  Banknote,
  Check,
  Crown,
  CreditCard,
  Smartphone,
  Sparkles,
  Wallet,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PAYMENT_METHODS, type PayMethod } from "@/lib/paymentMethodsList";
import { Loader2 } from "lucide-react";

function MethodIcon({ icon }: { icon: PayMethod["icon"] }) {
  const cls = "size-5";
  switch (icon) {
    case "card":
      return <CreditCard className={cls} />;
    case "wallet":
      return <Wallet className={cls} />;
    case "bank":
      return <Banknote className={cls} />;
    case "mobile":
      return <Smartphone className={cls} />;
    default:
      return <CreditCard className={cls} />;
  }
}

/** Payment-method picker shown before confirming a paid plan. */
function PaymentMethodPicker({
  lang,
  selected,
  onSelect,
  enabled,
}: {
  lang: "ar" | "en";
  selected: string;
  onSelect: (k: string) => void;
  enabled: Record<string, boolean> | null;
}) {
  const L = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const methods = PAYMENT_METHODS.filter(
    (m) => m.key === "stripe" || m.key === "bankTransfer" || enabled?.[m.key] !== false,
  );
  const arab = methods.filter((m) => m.region === "arab");
  const intl = methods.filter((m) => m.region === "international");

  const card = (m: PayMethod) => (
    <button
      key={m.key}
      type="button"
      onClick={() => onSelect(m.key)}
      className={cn(
        "flex w-full items-start gap-3 rounded-2xl border p-4 text-start transition-all",
        selected === m.key
          ? "border-primary bg-primary/5 shadow-sm shadow-primary/10"
          : "hover:border-primary/40 hover:bg-muted/40",
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          selected === m.key ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        <MethodIcon icon={m.icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 font-extrabold">
          {L(m.ar, m.en)}
          {selected === m.key && <BadgeCheck className="size-4 text-primary" />}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
          {L(m.descAr, m.descEn)}
        </span>
        {m.badges && (
          <span className="mt-1.5 flex flex-wrap gap-1">
            {m.badges.map((b) => (
              <span
                key={b}
                className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-black tracking-wide text-muted-foreground"
                dir="ltr"
              >
                {b}
              </span>
            ))}
          </span>
        )}
      </span>
    </button>
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-black">{L("وسائل الدفع الدولية", "International methods")}</h3>
        <div className="mt-2 grid gap-2.5 sm:grid-cols-2">{intl.map(card)}</div>
      </div>
      {arab.length > 0 && (
        <div>
          <h3 className="text-sm font-black">{L("وسائل الدفع العربية", "Arab regional methods")}</h3>
          <div className="mt-2 grid gap-2.5 sm:grid-cols-2">{arab.map(card)}</div>
        </div>
      )}
    </div>
  );
}

export default function Subscriptions() {
  const { lang, t } = useLang();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const plans = useQuery(api.subscriptions.listPlans, { activeOnly: true });
  const mySub = useQuery(api.subscriptions.mySubscription, {});
  const subscribe = useMutation(api.subscriptions.subscribe);
  const cancelSub = useMutation(api.subscriptions.cancelMySubscription);
  const createCheckout = useAction(api.payments.createCheckoutSession);
  const activateAfterCheckout = useAction(api.payments.activateAfterCheckout);
  const registerIntent = useMutation(api.manualPayments.registerIntent);
  const myPayRequests = useQuery(
    api.manualPayments.myRequests,
    isAuthenticated ? {} : "skip",
  );
  const [payReference, setPayReference] = useState("");
  const [paying, setPaying] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState("stripe");
  const [checkoutPlan, setCheckoutPlan] = useState<any>(null);

  // Handle return from Stripe Checkout (?success=1&session_id=...).
  useEffect(() => {
    const success = searchParams.get("success");
    const sessionId = searchParams.get("session_id");
    if (success && sessionId && isAuthenticated) {
      activateAfterCheckout({ sessionId })
        .then(() => {
          toast.success(
            lang === "ar" ? "تم تفعيل اشتراكك بنجاح 🎉" : "Subscription activated 🎉",
          );
        })
        .catch((e: any) => toast.error(e.message ?? "خطأ"))
        .finally(() => {
          setSearchParams({}, { replace: true });
        });
    } else if (searchParams.get("cancelled")) {
      toast.info(lang === "ar" ? "أُلغيت عملية الدفع" : "Checkout cancelled");
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isAuthenticated]);

  const handleSubscribe = async (planId: string) => {
    if (!isAuthenticated) {
      toast.error(lang === "ar" ? "سجّل الدخول للاشتراك" : "Sign in to subscribe");
      navigate("/auth?returnTo=%2Fsubscriptions");
      return;
    }
    if ((mySub?.plan as any)?._id === planId) return;

    const plan = (plans ?? []).find((p) => p._id === planId);
    if (plan && plan.price > 0) {
      // Paid plan → show the payment-method picker first.
      setCheckoutPlan(plan);
      return;
    }

    // Free plan → activate directly.
    setPaying(planId);
    try {
      await subscribe({ planId: planId as any });
      toast.success(
        lang === "ar" ? "تم تفعيل الباقة المجانية" : "Free plan activated",
      );
    } catch (e: any) {
      toast.error(e.message ?? "خطأ");
    } finally {
      setPaying(null);
    }
  };

  /** Continue with the chosen method from the picker dialog. */
  const confirmCheckout = async () => {
    if (!checkoutPlan) return;
    setPaying(checkoutPlan._id);
    try {
      if (selectedMethod === "stripe" || selectedMethod === "applepay") {
        // Card / Apple Pay → real Stripe Checkout when configured.
        const res: any = await createCheckout({ planId: checkoutPlan._id as any });
        window.location.href = res.url;
        return;
      }
      // Manual methods (wallets / bank transfer / Fawry) → register a payment
      // intent for admin review; the subscription activates upon approval.
      await registerIntent({
        planId: checkoutPlan._id as any,
        method: selectedMethod,
        reference: payReference.trim() || undefined,
      });
      toast.success(
        lang === "ar"
          ? "تم استلام طلب الدفع — سيُفعّل اشتراكك بعد مراجعة العملية"
          : "Payment request received — your subscription activates after review",
      );
      setCheckoutPlan(null);
      setPayReference("");
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.includes("STRIPE_SECRET_KEY")) {
        try {
          await subscribe({ planId: checkoutPlan._id as any });
          toast.success(
            lang === "ar"
              ? "تم تفعيل الاشتراك (وضع تجريبي — لم يُربط الدفع بعد)"
              : "Subscribed (demo mode — payment not wired yet)",
          );
          setCheckoutPlan(null);
        } catch (e2: any) {
          toast.error(e2.message ?? "خطأ");
        }
      } else {
        toast.error(msg || "خطأ");
      }
    } finally {
      setPaying(null);
    }
  };

  const handleCancel = async () => {
    try {
      await cancelSub({});
      toast.success(lang === "ar" ? "تم إلغاء الاشتراك" : "Subscription cancelled");
    } catch (e: any) {
      toast.error(e.message ?? "خطأ");
    }
  };

  const currentPlanId = (mySub?.plan as any)?._id;

  return (
    <div className="py-10">
      <SEO
        title={`${t("subscriptions")} | حكي`}
        description={lang === "ar" ? "اختر باقة حكي المناسبة لك واستمتع بكل المحتوى بلا حدود." : "Choose your HAKI plan and enjoy all content."}
      />
      <div className="haki-container">
        <div className="text-center">
          <h1 className="text-3xl font-black sm:text-4xl">{t("subscriptions")}</h1>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            {lang === "ar"
              ? "باقات مصممة لتناسب كل مستمع — اختر ما يناسبك واستمتع بتجربة بلا حدود."
              : "Plans for every listener — pick yours and enjoy unlimited access."}
          </p>
        </div>

        {/* Current subscription banner */}
        {mySub?.plan && (
          <div className="mx-auto mt-8 flex max-w-lg items-center justify-between rounded-2xl border bg-accent/60 p-4">
            <div className="flex items-center gap-3">
              <Crown className="size-5 text-primary" />
              <div>
                <p className="text-sm font-bold">
                  {lang === "ar" ? "اشتراكك الحالي: " : "Your plan: "}
                  {(mySub.plan as any).name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {lang === "ar" ? "ينتهي في " : "Expires "}
                  {new Date(mySub.expiresAt).toLocaleDateString(lang === "ar" ? "ar" : "en")}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleCancel} className="text-destructive">
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </Button>
          </div>
        )}

        {/* Plans */}
        {plans === undefined ? (
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-96 rounded-3xl" />
            ))}
          </div>
        ) : (
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {plans.map((plan) => {
              const isCurrent = currentPlanId === plan._id;
              const features = lang === "ar" ? plan.features : (plan.featuresEn ?? plan.features);
              return (
                <div
                  key={plan._id}
                  className={cn(
                    "relative flex flex-col rounded-3xl border bg-card p-7 transition-all card-shadow",
                    plan.isPopular && "border-primary shadow-lg shadow-primary/10",
                  )}
                >
                  {plan.isPopular && (
                    <Badge className="absolute -top-3 start-1/2 -translate-x-1/2 bg-primary px-3 py-1 text-white rtl:translate-x-1/2">
                      <Sparkles className="size-3" />
                      {lang === "ar" ? "الأكثر شيوعًا" : "Most popular"}
                    </Badge>
                  )}
                  <h2 className="text-lg font-extrabold">{lang === "ar" ? plan.name : plan.nameEn}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                  <div className="mt-5 flex items-baseline gap-1.5">
                    <span className="text-4xl font-black">{plan.price === 0 ? (lang === "ar" ? "مجانًا" : "Free") : plan.price}</span>
                    {plan.price > 0 && (
                      <span className="text-sm font-semibold text-muted-foreground">
                        {plan.currency} / {plan.period === "monthly" ? (lang === "ar" ? "شهريًا" : "month") : (lang === "ar" ? "سنويًا" : "year")}
                      </span>
                    )}
                  </div>
                  <ul className="mt-6 flex-1 space-y-2.5">
                    {features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span className="text-muted-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={cn("mt-7 w-full font-bold", isCurrent && "opacity-60")}
                    variant={plan.isPopular ? "default" : "outline"}
                    disabled={isCurrent || paying !== null}
                    onClick={() => handleSubscribe(plan._id)}
                  >
                    {paying === plan._id
                      ? "…"
                      : isCurrent
                        ? t("currentPlanBadge")
                        : t("choosePlan")}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {/* Payment trust strip */}
        <div className="mt-10 rounded-2xl border bg-card p-5">
          <p className="text-center text-xs font-bold text-muted-foreground">
            {lang === "ar" ? "وسائل دفع آمنة ومتنوعة — عربية ودولية" : "Secure & diverse payment methods — regional and global"}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {PAYMENT_METHODS.map((m) => (
              <span
                key={m.key}
                className="flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-[11px] font-bold text-muted-foreground"
              >
                <MethodIcon icon={m.icon} />
                {lang === "ar" ? m.ar : m.en}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Payment-method dialog */}
      {checkoutPlan && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCheckoutPlan(null);
          }}
        >
          <div className="w-full max-w-lg space-y-5 rounded-3xl border bg-background p-6 card-shadow">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black">
                  {lang === "ar" ? "اختر وسيلة الدفع" : "Choose payment method"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {lang === "ar" ? "الباقة: " : "Plan: "}
                  <span className="font-bold text-foreground">
                    {lang === "ar" ? checkoutPlan.name : checkoutPlan.nameEn}
                    {" — "}
                    {checkoutPlan.price} {checkoutPlan.currency}
                  </span>
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setCheckoutPlan(null)}>×</Button>
            </div>

            <PaymentMethodPicker
              lang={lang as "ar" | "en"}
              selected={selectedMethod}
              onSelect={setSelectedMethod}
              enabled={null}
            />

            {selectedMethod !== "stripe" && selectedMethod !== "applepay" && (
              <div className="space-y-1.5">
                <Label className="text-xs">
                  {lang === "ar"
                    ? selectedMethod === "bankTransfer"
                      ? "رقم الحوالة / مرجع التحويل"
                      : "رقم عملية الدفع من التطبيق"
                    : selectedMethod === "bankTransfer"
                      ? "Transfer reference number"
                      : "Payment transaction number"
                  }
                </Label>
                <Input
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                  dir="ltr"
                  placeholder="123456789"
                />
                <p className="text-[11px] text-muted-foreground">
                  {lang === "ar"
                    ? "سيُفعّل الاشتراك بعد التحقق من العملية (خلال 24 ساعة عادة)."
                    : "Subscription activates after we verify the transaction (usually within 24h)."}
                </p>
              </div>
            )}

            {(myPayRequests ?? []).filter((r: any) => r.status === "pending").length > 0 && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs font-bold text-amber-600 dark:text-amber-400">
                {lang === "ar"
                  ? "⏳ لديك طلب دفع قيد المراجعة — سنبلغك عند التفعيل"
                  : "⏳ You have a payment under review — we'll notify you once approved"}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 border-t pt-4">
              <Button variant="ghost" onClick={() => setCheckoutPlan(null)}>
                {lang === "ar" ? "رجوع" : "Back"}
              </Button>
              <Button className="min-w-40 font-bold" disabled={paying !== null} onClick={confirmCheckout}>
                {paying ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CreditCard className="size-4" />
                )}
                {lang === "ar" ? "تأكيد والدفع" : "Confirm & pay"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
