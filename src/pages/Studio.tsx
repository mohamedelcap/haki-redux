import { api } from "@/convex/_generated/api";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RequireAuth } from "@/components/RequireAuth";
import { LOGO_COVER } from "@/lib/logoAsset";
import { useLang } from "@/lib/i18n";
import { useMutation, useQuery } from "convex/react";
import { Coins, FileText, Loader2, Send } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

/**
 * Publisher/author studio: my works, submit for review, submission status.
 * Read-only earnings summary comes from royalty statements via my entity.
 */

function StudioInner() {
  const { lang } = useLang();
  const role = useQuery(api.studio.myRole, {});
  const works = useQuery(api.studio.myWorks, {});
  const submit = useMutation(api.studio.submitForReview);
  const [busy, setBusy] = useState<string | null>(null);
  const L = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const doSubmit = async (contentId: string) => {
    setBusy(contentId);
    try {
      await submit({ contentId: contentId as any });
      toast.success(L("أُرسل الطلب للمراجعة — سيصلك إشعار بالقرار", "Submitted for review — you'll be notified"));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="py-10">
      <SEO title={`${L("استوديو الناشر", "Publisher studio")} | حكي`} />
      <div className="haki-container">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-black sm:text-3xl">
              <FileText className="size-6 text-primary" />
              {L("استوديو الناشر", "Publisher studio")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {role?.name ? `${role.name} · ` : ""}
              {L("ارفع أعمالك وأرسلها للمراجعة وتابع حالة النشر.", "Upload your works, submit for review, and track publishing status.")}
            </p>
          </div>
          <Link to="/publish">
            <Button variant="outline" className="gap-1.5">
              {L("طلب نشر جديد", "New publishing request")}
            </Button>
          </Link>
        </div>

        {works === undefined ? (
          <div className="mt-8 space-y-3">
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
          </div>
        ) : works.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed p-10 text-center">
            <FileText className="mx-auto size-10 text-muted-foreground/50" />
            <p className="mt-3 font-bold">{L("لا أعمال بعد", "No works yet")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {L(
                "تواصل مع الإدارة لربط حسابك بملف ناشر/مؤلف، ثم ارفع عملك الأول من لوحة الإدارة.",
                "Contact the admin to link your account to a publisher/author profile, then upload your first work from the admin panel.",
              )}
            </p>
          </div>
        ) : (
          <div className="mt-8 overflow-x-auto rounded-2xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{L("العمل", "Work")}</TableHead>
                  <TableHead>{L("الحالة", "Status")}</TableHead>
                  <TableHead className="hidden md:table-cell">{L("المراجعة", "Review")}</TableHead>
                  <TableHead className="text-end">{L("إجراء", "Action")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {works.map((w) => (
                  <TableRow key={w._id}>
                    <TableCell>
                      <Link to={`/content/${w.slug}`} className="flex items-center gap-3">
                        <img
                          src={w.coverImage || LOGO_COVER}
                          alt=""
                          loading="lazy"
                          className="size-10 rounded-md object-cover"
                        />
                        <span className="font-bold hover:text-primary hover:underline">{w.title}</span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={w.status} L={L} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {w.submissionStatus === "pending" && <Badge variant="outline">{L("قيد المراجعة", "In review")}</Badge>}
                      {w.submissionStatus === "accepted" && <Badge className="bg-green-600 text-white">{L("مقبول", "Accepted")}</Badge>}
                      {w.submissionStatus === "rejected" && <Badge variant="destructive">{L("مرفوض", "Rejected")}</Badge>}
                      {!w.submissionStatus && <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-end">
                      {w.status === "draft" && w.submissionStatus !== "pending" && (
                        <Button
                          size="sm"
                          disabled={busy === w._id}
                          onClick={() => doSubmit(w._id)}
                          className="gap-1.5"
                        >
                          {busy === w._id ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                          {w.submissionStatus === "rejected" ? L("إعادة الإرسال", "Resubmit") : L("أرسل للمراجعة", "Submit")}
                        </Button>
                      )}
                      {w.status === "published" && (
                        <span className="text-xs font-semibold text-green-600">{L("منشور ✓", "Live ✓")}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Earnings pointer */}
        <div className="mt-8 flex items-center gap-3 rounded-2xl border bg-accent/40 p-5">
          <Coins className="size-6 text-primary" />
          <div className="flex-1">
            <p className="font-bold">{L("أرباحك", "Your earnings")}</p>
            <p className="text-sm text-muted-foreground">
              {L(
                "تُحسب الأرباح من حصة استماع أعمالك وتُوزَّع وفق عقد النشر — تصلك التقارير عبر الإدارة.",
                "Earnings derive from your works' listening share and your publishing contract — reports arrive via the admin team.",
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status, L }: { status: string; L: (ar: string, en: string) => string }) {
  if (status === "published") return <Badge className="bg-green-600 text-white">{L("منشور", "Published")}</Badge>;
  if (status === "archived") return <Badge variant="outline">{L("مؤرشف", "Archived")}</Badge>;
  return <Badge variant="secondary">{L("مسودة", "Draft")}</Badge>;
}

export default function Studio() {
  return (
    <RequireAuth
      title="الاستوديو للناشرين والمؤلفين"
      description="سجّل الدخول بحساب ناشر أو مؤلف لإدارة أعمالك."
    >
      <StudioInner />
    </RequireAuth>
  );
}
