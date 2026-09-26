import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/i18n";
import { useMutation, useQuery } from "convex/react";
import { Bell, BellPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router";

export function FollowPodcastButton({ contentId }: { contentId: string }) {
  const { t, lang } = useLang();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const L = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const isFollowing = useQuery(api.podcastFollows.isFollowing, {
    contentId: contentId as never,
  });
  const follow = useMutation(api.podcastFollows.follow);
  const unfollow = useMutation(api.podcastFollows.unfollow);
  const [busy, setBusy] = useState(false);

  const handleToggle = async () => {
    if (!isAuthenticated) {
      navigate(`/auth?returnTo=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setBusy(true);
    try {
      if (isFollowing) {
        await unfollow({ contentId: contentId as never });
        toast.success(L("تم إلغاء المتابعة", "Unfollowed"));
      } else {
        await follow({ contentId: contentId as never });
        toast.success(
          L(
            "تمت المتابعة — ستصلك إشعارات الحلقات الجديدة",
            "Following — you'll be notified of new episodes",
          ),
        );
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="lg"
      className="font-bold"
      disabled={busy}
      onClick={handleToggle}
      aria-pressed={isFollowing ?? false}
    >
      {isFollowing ? (
        <>
          <Bell className="size-4 text-primary" />
          {t("following")}
        </>
      ) : (
        <>
          <BellPlus className="size-4" />
          {t("followShow")}
        </>
      )}
    </Button>
  );
}
