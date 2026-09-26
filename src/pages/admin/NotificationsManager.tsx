import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQuery } from "convex/react";
import { Bell, Loader2, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function NotificationsManager({
  L,
}: {
  L: (ar: string, en: string) => string;
}) {
  const recent = useQuery(api.notifications.listRecent, {});
  const broadcast = useMutation(api.notifications.broadcast);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState<"all" | "subscribers">("all");
  const [sending, setSending] = useState(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSending(true);
    try {
      const res = await broadcast({ title: title.trim(), body: body.trim() || undefined, target });
      toast.success(L(`تم الإرسال إلى ${res.created} مستخدم`, `Sent to ${res.created} users`));
      setTitle("");
      setBody("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-black">
          <Bell className="size-5 text-primary" />
          {L("الإشعارات", "Notifications")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {L("أرسل إشعارات فورية لمستخدمي المنصة داخل جرس الإشعارات.", "Send instant in-app notifications to platform users.")}
        </p>
      </div>

      <form onSubmit={send} className="space-y-4 rounded-2xl border bg-card p-5 card-shadow">
        <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
          <div className="space-y-1.5">
            <Label>{L("عنوان الإشعار", "Title")} *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label>{L("الجمهور", "Audience")}</Label>
            <Select value={target} onValueChange={(v) => setTarget(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{L("كل المستخدمين", "All users")}</SelectItem>
                <SelectItem value="subscribers">{L("المشتركون فقط", "Subscribers only")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{L("النص (اختياري)", "Body (optional)")}</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} maxLength={300} />
        </div>
        <Button type="submit" className="font-bold" disabled={sending}>
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          {L("إرسال الإشعار", "Send notification")}
        </Button>
      </form>

      <div className="rounded-2xl border bg-card p-5 card-shadow">
        <h3 className="font-extrabold">{L("آخر الإشعارات المرسلة", "Recently sent")}</h3>
        {recent === undefined ? (
          <div className="mt-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{L("لا إشعارات بعد", "Nothing sent yet")}</p>
        ) : (
          <div className="mt-4 space-y-2">
            {recent.slice(0, 12).map((n) => (
              <div key={n._id} className="flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{n.title}</p>
                  {n.body && <p className="truncate text-xs text-muted-foreground">{n.body}</p>}
                </div>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground" dir="ltr">
                  {new Date(n.createdAt).toISOString().slice(0, 10)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
