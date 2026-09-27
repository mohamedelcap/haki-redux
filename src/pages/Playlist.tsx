import { api } from "@/convex/_generated/api";
import { SEO } from "@/components/SEO";
import { ContentCard } from "@/components/ContentCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { RequireAuth } from "@/components/RequireAuth";
import { usePlayer } from "@/lib/player";
import { demoAudioUrl, type QueueItem } from "@/lib/player";
import { useLang } from "@/lib/i18n";
import { useMutation, useQuery } from "convex/react";
import { ListMusic, ListPlus, Loader2, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

/**
 * Playlist page: ordered works with "play all" (feeds the player queue
 * with the playlist order) and item management for the owner.
 */

function PlaylistInner() {
  const { id } = useParams<{ id: string }>();
  const { lang, t } = useLang();
  const navigate = useNavigate();
  const player = usePlayer();
  const pl = useQuery(api.playlists.getById, id ? { id: id as any } : "skip");
  const chapters = useQuery(
    api.content.listChapters,
    pl && pl.items.length > 0 ? { contentId: pl.items[0]._id } : "skip",
  );
  const removeItem = useMutation(api.playlists.removeItem);
  const removePl = useMutation(api.playlists.remove);
  const [busy, setBusy] = useState(false);
  const L = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const playAll = () => {
    if (!pl || pl.items.length === 0) return;
    setBusy(true);
    try {
      const first = pl.items[0] as any;
      const chs = (chapters ?? []) as { _id: string; title: string; duration: number; audioUrl?: string | null }[];
      const track = {
        contentId: first._id,
        title: first.title,
        coverImage: first.coverImage ?? undefined,
        authorName: first.authorName ?? undefined,
        narratorName: first.narratorName ?? undefined,
        audioUrl: chs[0]?.audioUrl || first.audioUrl || demoAudioUrl(first._id),
        startOffset: 0,
        startAt: 0,
      };
      const queue: QueueItem[] = pl.items.map((c: any, i: number) => ({
        track: {
          contentId: c._id,
          title: c.title,
          coverImage: c.coverImage ?? undefined,
          authorName: c.authorName ?? undefined,
          narratorName: c.narratorName ?? undefined,
          audioUrl: c.audioUrl || demoAudioUrl(c._id),
          startOffset: 0,
          startAt: 0,
        },
        label: `${i + 1}/${pl.items.length} · ${c.title}`,
      }));
      player.playWithQueue(track, queue);
      toast.success(L("تشغيل القائمة", "Playing playlist"));
    } finally {
      setBusy(false);
    }
  };

  if (pl === undefined) {
    return (
      <div className="haki-container space-y-4 py-10">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    );
  }

  if (pl === null) {
    return (
      <div className="haki-container py-24 text-center">
        <p className="text-xl font-bold">{L("القائمة غير موجودة", "Playlist not found")}</p>
        <Link to="/library" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
          {t("myLibrary")}
        </Link>
      </div>
    );
  }

  return (
    <div className="py-10">
      <SEO title={`${pl.name} | حكي`} description={pl.description ?? undefined} />
      <div className="haki-container">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-accent">
              <ListMusic className="size-7 text-accent-foreground" />
            </span>
            <div>
              <h1 className="text-2xl font-black sm:text-3xl">{pl.name}</h1>
              <p className="text-sm text-muted-foreground">
                {pl.items.length} {L("عمل", "items")}
                {pl.ownerName ? ` · ${pl.ownerName}` : ""}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button className="font-bold" disabled={busy || pl.items.length === 0} onClick={playAll}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4 fill-current" />}
              {L("شغّل الكل", "Play all")}
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                if (!window.confirm(L("حذف القائمة نهائيًا؟", "Delete this playlist permanently?"))) return;
                try {
                  await removePl({ id: id as any });
                  toast.success(L("حُذفت القائمة", "Playlist deleted"));
                  navigate("/library");
                } catch (e: any) {
                  toast.error(e.message);
                }
              }}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-4" />
              {L("حذف القائمة", "Delete")}
            </Button>
          </div>
        </div>

        {pl.items.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed p-10 text-center">
            <ListPlus className="mx-auto size-10 text-muted-foreground/50" />
            <p className="mt-3 font-bold">{L("القائمة فارغة", "This playlist is empty")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {L("أضف أعمالًا من زر «أضف إلى قائمة» في صفحة أي عمل.", "Add works with the \"Add to list\" button on any work page.")}
            </p>
            <Link to="/browse">
              <Button variant="outline" className="mt-4">{t("browseLibrary")}</Button>
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {pl.items.map((item) => (
              <div key={item._id} className="space-y-1">
                <ContentCard item={item as any} />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await removeItem({ id: id as any, contentId: item._id as any });
                      toast.success(L("أُزيل من القائمة", "Removed from playlist"));
                    } catch (e: any) {
                      toast.error(e.message);
                    }
                  }}
                  className="text-xs font-semibold text-muted-foreground hover:text-destructive"
                >
                  {L("إزالة", "Remove")}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PlaylistPage() {
  return (
    <RequireAuth
      title="سجّل الدخول لعرض القوائم"
      description="قوائمك الخاصة متاحة للمستخدمين المسجلين."
    >
      <PlaylistInner />
    </RequireAuth>
  );
}
