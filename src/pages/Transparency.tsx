import { api } from "@/convex/_generated/api";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { useLang } from "@/lib/i18n";
import { useQuery } from "convex/react";
import { ExternalLink, Github, ShieldCheck } from "lucide-react";
import { Link } from "react-router";

/**
 * Public transparency page (/transparency): recent GitHub issues created from
 * platform reports, plus aggregate counts. Read-only, no auth required.
 */
export default function Transparency() {
  const { lang } = useLang();
  const L = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const issues = useQuery(api.githubReports.publicRecentIssues, { limit: 12 });

  return (
    <div className="py-10">
      <SEO
        title={`${L("شفافية البلاغات", "Report transparency")} | حكي`}
        description={L(
          "بلاغات مشاكل المنصة التي تحوّلت إلى Issues عامة على GitHub.",
          "Platform problem reports that became public issues on GitHub.",
        )}
      />
      <div className="haki-container max-w-4xl">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10">
            <ShieldCheck className="size-6 text-primary" />
          </span>
          <div>
            <h1 className="text-2xl font-black sm:text-3xl">
              {L("شفافية البلاغات", "Report transparency")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {L(
                "كل بلاغ يرسله المستخدمون أو الإدارة عبر زر «أبلغ عن مشكلة» يتحول إلى Issue عام في مستودعنا على GitHub — وهذه أحدث البلاغات.",
                "Every report sent through the “Report a problem” button becomes a public issue in our GitHub repo — these are the latest ones.",
              )}
            </p>
          </div>
        </div>

        {issues === undefined ? (
          <div className="mt-8 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : issues.length === 0 ? (
          <div className="mt-10 rounded-2xl border bg-card p-10 text-center">
            <Github className="mx-auto size-8 text-muted-foreground/50" />
            <p className="mt-3 font-bold">{L("لا توجد بلاغات منشورة بعد", "No published reports yet")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {L(
                "عند وصول أول بلاغ إلى GitHub سيظهر هنا تلقائيًا.",
                "Once the first report reaches GitHub it will appear here automatically.",
              )}
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-2">
            {issues.map((r) => (
              <a
                key={r.issueNumber}
                href={r.issueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted"
              >
                <Github className="size-5 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold" dir="auto">{r.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleDateString(lang === "ar" ? "ar" : "en")}
                  </span>
                </span>
                {r.labels.slice(0, 2).map((l) => (
                  <Badge key={l} variant="outline" className="hidden text-[10px] sm:inline-flex">
                    {l}
                  </Badge>
                ))}
                <Badge variant="secondary" className="shrink-0">#{r.issueNumber}</Badge>
                <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
              </a>
            ))}
          </div>
        )}

        <div className="mt-10 rounded-2xl border bg-secondary/50 p-5 text-sm">
          <p className="font-extrabold">{L("كيف يعمل النظام؟", "How it works")}</p>
          <ol className="mt-2 list-decimal space-y-1 ps-5 leading-relaxed text-muted-foreground">
            <li>{L("يضغط المستخدم «أبلغ عن مشكلة» في صفحة المحتوى أو ترسل الإدارة بلاغًا.", "A user taps “Report a problem” on a content page, or the team files one.")}</li>
            <li>{L("يُحفظ البلاغ في سجل المنصة أولًا (فلا يضيع أبدًا)، ثم يُرسل إلى GitHub.", "The report is saved to the platform log first (so it is never lost), then sent to GitHub.")}</li>
            <li>{L("البلاغات الناجحة تصبح Issues عامة هنا، والفريق يعالجها علنًا.", "Successful reports become public issues here, handled openly by the team.")}</li>
          </ol>
          <Link
            to="/about#contact"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
          >
            {L("أو تواصل معنا مباشرة", "Or contact us directly")}
          </Link>
        </div>
      </div>
    </div>
  );
}
