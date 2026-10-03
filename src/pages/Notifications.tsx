import { api } from "@/convex/_generated/api";
import { SEO } from "@/components/SEO";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { Bell, CheckCheck } from "lucide-react";

function NotificationsInner() {
  const { lang } = useLang();
  const L = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const items = useQuery(api.library.myNotifications, {});
  const markRead = useMutation(api.library.markNotificationRead);
  const markAll = useMutation(api.library.markAllNotificationsRead);

  const unread = (items ?? []).filter((n) => !n.isRead).length;

  const when = (ts: number) =>
    new Date(ts).toLocaleString(lang === "ar" ? "ar-EG" : "en", {
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <div className="py-10">
      <SEO title={`${L("الإشعارات", "Notifications")} | حكي`} />
      <div className="haki-container max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black sm:text-3xl">
              {L("الإشعارات", "Notifications")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {unread > 0
                ? L(`لديك ${unread} إشعارًا غير مقروء`, `${unread} unread notifications`)
                : L("كل شيء محدَّث", "You're all caught up")}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 font-bold"
            disabled={unread === 0}
            onClick={() => markAll({})}
          >
            <CheckCheck className="size-4" />
            {L("تحديد الكل كمقروء", "Mark all read")}
          </Button>
        </div>

        {items === undefined ? (
          <div className="mt-8 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="mt-12 rounded-3xl border bg-card p-12 text-center">
            <Bell className="mx-auto size-10 text-muted-foreground/50" />
            <p className="mt-4 text-lg font-bold">
              {L("لا توجد إشعارات بعد", "No notifications yet")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {L(
                "سنُعلمك عند نشر محتوى جديد أو تحديث اشتراكك أو إنجازات التحديات.",
                "We'll let you know about new content, subscription updates and challenge milestones.",
              )}
            </p>
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            {items.map((n) => (
              <li key={n._id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!n.isRead) markRead({ id: n._id });
                  }}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-2xl border bg-card p-4 text-start transition-colors hover:bg-muted/50",
                    !n.isRead && "border-primary/40 bg-primary/5",
                  )}
                >
                  <span
                    className={cn(
                      "mt-1.5 size-2.5 shrink-0 rounded-full",
                      n.isRead ? "bg-muted" : "bg-primary",
                    )}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{n.title}</span>
                    {n.body && (
                      <span className="mt-0.5 block text-sm leading-relaxed text-muted-foreground">
                        {n.body}
                      </span>
                    )}
                    <span className="mt-1 block text-xs text-muted-foreground/80" dir="ltr">
                      {when(n.createdAt)}
                    </span>
                  </span>
                  {!n.isRead && (
                    <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-black text-primary">
                      {L("جديد", "NEW")}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const { lang } = useLang();
  return (
    <RequireAuth
      title={lang === "ar" ? "سجّل الدخول لعرض إشعاراتك" : "Sign in to see notifications"}
      description={
        lang === "ar"
          ? "إشعاراتك متاحة لحسابات المسجلة فقط."
          : "Notifications are available to signed-in accounts."
      }
    >
      <NotificationsInner />
    </RequireAuth>
  );
}
