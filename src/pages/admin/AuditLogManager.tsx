import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { History } from "lucide-react";

const ACTION_COLORS: Record<string, string> = {
  approve_submission: "bg-green-100 text-green-700",
  approve_manual_payment: "bg-green-100 text-green-700",
  reject_manual_payment: "bg-red-100 text-red-700",
  delete_content: "bg-red-100 text-red-700",
  update_submission_status: "bg-blue-100 text-blue-700",
};

/**
 * Audit trail viewer: who did what, to which entity, and when.
 */
export function AuditLogManager({ L }: { L: (ar: string, en: string) => string }) {
  const page = useQuery(api.adminAudit.list, {});
  const rows = page?.page ?? [];

  return (
    <div>
      <h2 className="flex items-center gap-2 text-xl font-black">
        <History className="size-5 text-primary" />
        {L("سجل التدقيق الإداري", "Admin audit log")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {L(
          "كل عملية حساسة تُسجَّل تلقائيًا: من، ماذا، على أي كيان، ومتى.",
          "Every sensitive action is recorded: who, what, which entity, when.",
        )}
      </p>

      {page === undefined ? (
        <Skeleton className="mt-6 h-64 rounded-2xl" />
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">{L("لا سجلات بعد", "No entries yet")}</p>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b bg-secondary/60 text-xs text-muted-foreground">
                  <th className="p-3.5 text-start font-semibold">{L("المنفّذ", "Actor")}</th>
                  <th className="p-3.5 text-start font-semibold">{L("الإجراء", "Action")}</th>
                  <th className="p-3.5 text-start font-semibold">{L("الكيان", "Entity")}</th>
                  <th className="p-3.5 text-start font-semibold">{L("تفاصيل", "Detail")}</th>
                  <th className="p-3.5 text-start font-semibold">{L("التاريخ", "When")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r._id} className="border-b last:border-0 transition-colors hover:bg-muted/50">
                    <td className="p-3.5">
                      <span className="font-bold">{r.actorName ?? "—"}</span>
                      {r.actorRole && (
                        <span className="ms-1.5 text-xs text-muted-foreground">{r.actorRole}</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <Badge className={ACTION_COLORS[r.action] ?? "bg-secondary"}>{r.action}</Badge>
                    </td>
                    <td className="p-3.5 font-mono text-xs" dir="ltr">
                      {r.entity}
                      {r.entityId ? `:${r.entityId.slice(-6)}` : ""}
                    </td>
                    <td className="max-w-[220px] truncate p-3.5 text-muted-foreground">{r.detail ?? "—"}</td>
                    <td className="p-3.5 text-xs tabular-nums text-muted-foreground" dir="ltr">
                      {new Date(r.createdAt).toLocaleString("ar")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {page?.continueCursor && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              /* load-more handled by reactive query params in a future pass */
            }}
          >
            {L("تحميل المزيد", "Load more")}
          </Button>
        </div>
      )}
    </div>
  );
}
