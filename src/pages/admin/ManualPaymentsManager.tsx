import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useMutation, useQuery } from "convex/react";
import { BadgeCheck, Check, ClipboardList, Loader2, Wallet, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const METHOD_LABEL: Record<string, { ar: string; en: string }> = {
  stripe: { ar: "Stripe — بطاقات", en: "Stripe — cards" },
  bankTransfer: { ar: "تحويل بنكي", en: "Bank transfer" },
  fawry: { ar: "فوري", en: "Fawry" },
  stcpay: { ar: "STC Pay", en: "STC Pay" },
  vodafonecash: { ar: "فودافون كاش", en: "Vodafone Cash" },
};

export function ManualPaymentsManager({
  L,
}: {
  L: (ar: string, en: string) => string;
}) {
  const pending = useQuery(api.manualPayments.listPending, {});
  const history = useQuery(api.manualPayments.listAll, {});
  const approve = useMutation(api.manualPayments.approve);
  const rejectM = useMutation(api.manualPayments.reject);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const methodName = (m: string) => {
    const found = METHOD_LABEL[m];
    return found ? L(found.ar, found.en) : m;
  };

  const fmt = (ts: number) =>
    new Date(ts).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

  const doApprove = async (id: string) => {
    setBusy(id);
    try {
      await approve({ id: id as any });
      toast.success(L("تم تفعيل الاشتراك وإشعار المستخدم", "Subscription activated, user notified"));
      setRejecting(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  const doReject = async (id: string) => {
    setBusy(id);
    try {
      await rejectM({ id: id as any, reason: reason.trim() || undefined });
      toast.success(L("تم رفض الطلب وإشعار المستخدم", "Request rejected, user notified"));
      setRejecting(null);
      setReason("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-black">
          <Wallet className="size-5 text-primary" />
          {L("طلبات الدفع بانتظار التأكيد", "Payments awaiting confirmation")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {L(
            "راجع مرجع التحويل (رقم العملية) ثم وافق ليُفعّل اشتراك المستخدم فورًا مع إشعار له.",
            "Review the transfer reference, then approve to activate the subscription instantly with a notification.",
          )}
        </p>
      </div>

      {/* Pending queue */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          <Loader2 className={pending !== undefined ? "size-4 text-muted-foreground/50" : "size-4 animate-spin text-primary"} />
          {L("قيد المراجعة", "Pending review")}
          {pending !== undefined && pending.length > 0 && (
            <Badge className="bg-primary text-primary-foreground">{pending.length}</Badge>
          )}
        </h3>
        {pending === undefined ? (
          <div className="space-y-3">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        ) : pending.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            {L("لا طلبات معلقة — كل شيء مُراجع ✨", "No pending requests — all clear ✨")}
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((r: any) => (
              <div
                key={r._id}
                className="rounded-2xl border bg-card p-5 card-shadow transition-shadow hover:shadow-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <p className="flex items-center gap-2 font-extrabold">
                      <ClipboardList className="size-4 text-primary" />
                      {r.userName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {L("الباقة", "Plan")}: <span className="font-semibold text-foreground">{r.planName}</span>
                      {" · "}
                      {L("الوسيلة", "Method")}: <span className="font-semibold text-foreground">{methodName(r.method)}</span>
                      {" · "}
                      <span dir="ltr" className="font-bold text-primary">
                        {r.amount} {String(r.currency).toUpperCase()}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">{fmt(r.createdAt)}</p>
                    {r.reference ? (
                      <p className="text-sm">
                        {L("رقم العملية", "Reference")}:{" "}
                        <code dir="ltr" className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                          {r.reference}
                        </code>
                      </p>
                    ) : (
                      <p className="text-xs italic text-muted-foreground">
                        {L("بدون رقم عملية مدخل", "No reference provided")}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      size="sm"
                      disabled={busy === r._id}
                      onClick={() => doApprove(r._id)}
                      className="gap-1.5 bg-green-600 text-white hover:bg-green-700"
                    >
                      {busy === r._id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                      {L("موافقة", "Approve")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === r._id}
                      onClick={() => { setRejecting(r._id); setReason(""); }}
                      className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="size-4" />
                      {L("رفض", "Reject")}
                    </Button>
                  </div>
                </div>
                {rejecting === r._id && (
                  <div className="mt-3 w-full rounded-xl border bg-muted/40 p-3">
                    <p className="mb-2 text-xs font-bold">{L("سبب الرفض (اختياري)", "Rejection reason (optional)")}</p>
                    <div className="flex gap-2">
                      <Input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder={L("مثال: لم يُرصد التحويل بعد", "e.g. transfer not traced yet")}
                      />
                      <Button size="sm" variant="destructive" disabled={busy === r._id} onClick={() => doReject(r._id)}>
                        {busy === r._id ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setRejecting(null); setReason(""); }}>
                        {L("إلغاء", "Cancel")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* History */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          <BadgeCheck className="size-4" />
          {L("سجل الطلبات", "History")}
        </h3>
        {history === undefined ? (
          <Skeleton className="h-40 rounded-2xl" />
        ) : history.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            {L("لا سجل بعد", "No history yet")}
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((r: any) => (
              <div key={r._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-bold">{r.userName ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {methodName(r.method)} · <span dir="ltr">{r.amount} {String(r.currency).toUpperCase()}</span> · {fmt(r.createdAt)}
                  </p>
                </div>
                <StatusBadge status={r.status} L={L} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status, L }: { status: string; L: (ar: string, en: string) => string }) {
  if (status === "approved") return <Badge className="bg-green-600 text-white">{L("مُعتمد", "Approved")}</Badge>;
  if (status === "rejected") return <Badge variant="destructive">{L("مرفوض", "Rejected")}</Badge>;
  return <Badge variant="outline">{L("قيد المراجعة", "Pending")}</Badge>;
}
