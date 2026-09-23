import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { Bell, CheckCheck } from "lucide-react";
import { Link } from "react-router";

type Notification = {
  _id: string;
  title: string;
  body?: string;
  isRead: boolean;
  createdAt: number;
};

export function NotificationsBell() {
  const { t } = useLang();
  const { isAuthenticated } = useAuth();
  const notifications = useQuery(
    api.library.myNotifications,
    isAuthenticated ? {} : "skip",
  ) as Notification[] | undefined;
  const markOne = useMutation(api.library.markNotificationRead);
  const markAll = useMutation(api.library.markAllNotificationsRead);

  if (!isAuthenticated) return null;

  const unread = (notifications ?? []).filter((n) => !n.isRead).length;

  const formatTime = (ts: number) => {
    try {
      return new Date(ts).toLocaleDateString("ar", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={t("notifications")}
        >
          <Bell className="size-5" />
          {unread > 0 && (
            <span
              className={cn(
                "absolute -top-0.5 end-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-black leading-4 text-white",
              )}
            >
              {unread > 9 ? "+9" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-extrabold">{t("notifications")}</p>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => void markAll({})}
            >
              <CheckCheck className="size-3.5" />
              {t("markAllRead")}
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications === undefined ? (
            <div className="space-y-2 p-4">
              <div className="h-12 animate-pulse rounded-lg bg-muted" />
              <div className="h-12 animate-pulse rounded-lg bg-muted" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-6 text-center">
              <Bell className="mx-auto size-6 text-muted-foreground/50" />
              <p className="mt-2 text-sm font-semibold text-muted-foreground">
                {t("noNotifications")}
              </p>
            </div>
          ) : (
            (notifications ?? []).map((n) => (
              <div
                key={n._id}
                className={cn(
                  "border-b px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/50",
                  !n.isRead && "bg-primary/5",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold leading-snug">{n.title}</p>
                    {n.body && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {n.body}
                      </p>
                    )}
                    <p className="mt-1 text-[10px] text-muted-foreground/70">
                      {formatTime(n.createdAt)}
                    </p>
                  </div>
                  {!n.isRead && (
                    <button
                      type="button"
                      className="mt-0.5 size-2 shrink-0 rounded-full bg-primary"
                      aria-label={t("markRead")}
                      onClick={() => void markOne({ id: n._id as never })}
                    />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Keep Link import used for future deep-links from notifications.
void Link;
