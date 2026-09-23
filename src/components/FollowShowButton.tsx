import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/i18n";
import { useMutation, useQuery } from "convex/react";
import { BellPlus, BellRing } from "lucide-react";
import { toast } from "sonner";

export function FollowShowButton({ contentId }: { contentId: string }) {
  const { t, lang } = useLang();
  const { isAuthenticated } = useAuth();
  const L = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const following = useQuery(
    api.podcasts.isFollowing,
    isAuthenticated ? { contentId: contentId as never } : "skip",
  );
  const toggle = useMutation(api.podcasts.toggleFollow);

  const handleToggle = async () => {
    if (!isAuthenticated) {
      toast.error(L("سجّل الدخول لمتابعة البرنامج", "Sign in to follow this show"));
      return;
    }
    try {
      const res = await toggle({ contentId: contentId as never });
      toast.success(
        res.following
          ? L("تمت المتابعة — ستُشعَر بالحلقات الجديدة", "Following — you'll be notified of new episodes")
          : L("أُلغيت المتابعة", "Unfollowed"),
      );
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Button
      size="lg"
      variant="outline"
      className="gap-2 bg-background font-bold"
      onClick={handleToggle}
      aria-pressed={following ?? false}
    >
      {following ? (
        <>
          <BellRing className="size-4 text-primary" />
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
