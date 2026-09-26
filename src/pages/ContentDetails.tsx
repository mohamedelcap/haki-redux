import { api } from "@/convex/_generated/api";
import { SEO } from "@/components/SEO";
import { ContentTypeIcon, TYPE_LABELS } from "@/components/ContentCard";
import { demoAudioUrl } from "@/lib/player";
import { LOGO_COVER } from "@/lib/logoAsset";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RatingsSection } from "@/components/RatingsSection";
import { FollowPodcastButton } from "@/components/FollowPodcastButton";
import { useAuth } from "@/hooks/use-auth";
import { formatDuration, formatTime, useLang } from "@/lib/i18n";
import { usePlayer } from "@/lib/player";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  Bookmark,
  BookmarkCheck,
  Check,
  Clock,
  Headphones,
  Link2,
  ListPlus,
  Play,
} from "lucide-react";
import { useMemo } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

export default function ContentDetails() {
  const { slug } = useParams<{ slug: string }>();
  const { lang, t } = useLang();
  const { isAuthenticated } = useAuth();
  const player = usePlayer();
  const item = useQuery(api.content.getBySlug, { slug: slug ?? "" });
  const chapters = useQuery(
    api.content.listChapters,
    item ? { contentId: item._id } : "skip",
  );
  const episodes = useQuery(
    api.content.listEpisodes,
    item ? { contentId: item._id } : "skip",
  );
  const progress = useQuery(
    api.library.getProgress,
    item && isAuthenticated ? { contentId: item._id } : "skip",
  );
  const inList = useQuery(
    api.library.isInLibrary,
    item && isAuthenticated ? { contentId: item._id, kind: "mylist" } : "skip",
  );
  const toggleLibrary = useMutation(api.library.toggleLibrary);

  const hasChapters = (chapters?.length ?? 0) > 0;
  const hasEpisodes = (episodes?.length ?? 0) > 0;
  const trackList = hasChapters ? chapters : episodes;

  // Chapter start offsets: cumulative durations
  const offsets = useMemo(() => {
    const map = new Map<string, number>();
    let acc = 0;
    for (const ch of trackList ?? []) {
      map.set(ch._id, acc);
      acc += ch.duration;
    }
    return map;
  }, [trackList]);

  if (item === undefined) {
    return (
      <div className="haki-container grid gap-8 py-10 lg:grid-cols-[300px_1fr]">
        <Skeleton className="aspect-[3/4] rounded-2xl" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="haki-container py-24 text-center">
        <p className="text-xl font-bold">{lang === "ar" ? "لم يتم العثور على المحتوى" : "Content not found"}</p>
        <Link to="/browse" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
          {t("browseLibrary")}
        </Link>
      </div>
    );
  }

  const typeLabel = TYPE_LABELS[item.contentType]?.[lang] ?? item.contentType;
  const resumePosition = progress?.position ?? 0;

  const startPlayback = (opts?: { chapterId?: string; fromStart?: boolean }) => {
    if (hasChapters || hasEpisodes) {
      const list = (trackList ?? []) as { _id: string; title: string; duration: number; audioUrl?: string | null }[];
      let target = list[0];
      if (opts?.chapterId) {
        target = list.find((c) => c._id === opts.chapterId) ?? list[0];
      } else if (!opts?.fromStart && resumePosition > 0) {
        // Resume: pick the chapter that contains the saved position (absolute time).
        const found = list.find((c) => {
          const off = offsets.get(c._id) ?? 0;
          return resumePosition >= off && resumePosition < off + c.duration;
        });
        if (found) target = found;
      }
      const startOffset = target ? (offsets.get(target._id) ?? 0) : 0;
      const withinChapter =
        target && !opts?.fromStart && resumePosition > startOffset && resumePosition < startOffset + target.duration
          ? resumePosition - startOffset
          : 0;
      player.play({
        contentId: item._id,
        title: `${item.title} — ${target?.title ?? ""}`,
        coverImage: item.coverImage,
        authorName: item.authorName,
        narratorName: item.narratorName,
        audioUrl: target?.audioUrl || demoAudioUrl(item._id),
        startOffset,
        startAt: startOffset + withinChapter,
      });
    } else {
      const startAt = opts?.fromStart ? 0 : resumePosition;
      player.play({
        contentId: item._id,
        title: item.title,
        coverImage: item.coverImage,
        authorName: item.authorName,
        narratorName: item.narratorName,
        audioUrl: item.audioUrl || demoAudioUrl(item._id),
        startOffset: 0,
        startAt,
      });
    }
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: item.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success(lang === "ar" ? "تم نسخ الرابط" : "Link copied");
      }
    } catch {
      /* user cancelled */
    }
  };

  const toggleList = async () => {
    if (!isAuthenticated) {
      toast.error(lang === "ar" ? "سجّل الدخول أولًا" : "Please sign in first");
      return;
    }
    const res = await toggleLibrary({ contentId: item._id, kind: "mylist" });
    toast.success(
      res.added
        ? lang === "ar" ? "أُضيف إلى قائمتي" : "Added to your list"
        : lang === "ar" ? "أُزيل من قائمتي" : "Removed from your list",
    );
  };

  return (
    <div className="pb-10">
      <SEO
        title={`${item.title} | حكي`}
        description={item.description.slice(0, 150)}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Audiobook",
          name: item.title,
          author: item.authorName ? { "@type": "Person", name: item.authorName } : undefined,
          readBy: item.narratorName ? { "@type": "Person", name: item.narratorName } : undefined,
          description: item.description,
          inLanguage: "ar",
          image: item.coverImage ?? undefined,
        }}
      />

      {/* Hero backdrop */}
      <div className="relative border-b bg-secondary/50">
        <div
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage: `url(${item.coverImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(40px)",
          }}
          aria-hidden="true"
        />
        <div className="haki-container relative grid gap-8 py-10 lg:grid-cols-[280px_1fr]">
          <div className="mx-auto w-48 sm:w-56 lg:w-full lg:max-w-[280px]">
            <img
              src={item.coverImage || LOGO_COVER}
              alt={item.title}
              className="aspect-[3/4] w-full rounded-2xl border object-cover card-shadow"
              loading="lazy"
            />
          </div>

          <div className="flex flex-col justify-center">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1 bg-background">
                <ContentTypeIcon type={item.contentType} className="size-3.5 text-primary" />
                {typeLabel}
              </Badge>
              {item.categories.slice(0, 3).map((c) => (
                <Link key={c.id} to={`/browse?category=${c.slug}`}>
                  <Badge variant="outline" className="font-medium hover:bg-muted">
                    {c.name}
                  </Badge>
                </Link>
              ))}
            </div>

            <h1 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">{item.title}</h1>

            <div className="mt-3 space-y-1 text-sm text-muted-foreground">
              {item.authorName && (
                <p className="flex items-center gap-2">
                  {t("by")} {" "}
                  <Avatar className="size-6">
                    {item.authorImage ? (
                      <AvatarImage src={item.authorImage} alt={item.authorName} loading="lazy" />
                    ) : null}
                    <AvatarFallback className="bg-accent text-[10px] font-bold text-accent-foreground">
                      {item.authorName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  {item.authorId ? (
                    <Link
                      to={`/author/${item.authorId}`}
                      className="font-bold text-foreground hover:text-primary hover:underline"
                    >
                      {item.authorName}
                    </Link>
                  ) : (
                    <span className="font-bold text-foreground">{item.authorName}</span>
                  )}
                </p>
              )}
              {item.narratorName && (
                <p>
                  {t("narratedBy")}{" "}
                  {item.narratorId ? (
                    <Link
                      to={`/narrator/${item.narratorId}`}
                      className="font-bold text-foreground hover:text-primary hover:underline"
                    >
                      {item.narratorName}
                    </Link>
                  ) : (
                    <span className="font-bold text-foreground">{item.narratorName}</span>
                  )}
                </p>
              )}
              {item.publisherName && (
                <p className="flex items-center gap-2">
                  {item.publisherLogo ? (
                    <img
                      src={item.publisherLogo}
                      alt=""
                      loading="lazy"
                      className="size-5 rounded object-cover"
                    />
                  ) : null}
                  {item.publisherName}
                </p>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5" />
                {formatDuration(item.duration, lang)}
              </span>
              {hasChapters && (
                <span className="flex items-center gap-1.5">
                  <Headphones className="size-3.5" />
                  {item.chapterCount} {t("sectionCount")}
                </span>
              )}
              {hasEpisodes && (
                <span className="flex items-center gap-1.5">
                  <Headphones className="size-3.5" />
                  {item.episodeCount} {t("episodeCount")}
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <Button size="lg" className="font-bold" onClick={() => startPlayback()}>
                <Play className="size-4 fill-current" />
                {resumePosition > 30
                  ? lang === "ar"
                    ? `متابعة من ${formatTime(resumePosition)}`
                    : `Resume ${formatTime(resumePosition)}`
                  : t("listenNow")}
              </Button>
              <Button size="lg" variant="outline" className="bg-background font-semibold" onClick={toggleList}>
                {inList ? <BookmarkCheck className="size-4 text-primary" /> : <Bookmark className="size-4" />}
                {t("addToMyList")}
              </Button>
              <Button size="lg" variant="ghost" onClick={share} aria-label={t("share")}>
                <Link2 className="size-4" />
                {t("share")}
              </Button>
              {item.contentType === "podcast" && (
                <FollowPodcastButton contentId={item._id} />
              )}
            </div>

            {resumePosition > 30 && (
              <button
                type="button"
                onClick={() => startPlayback({ fromStart: true })}
                className="mt-3 flex w-fit items-center gap-2 text-xs font-semibold text-primary hover:underline"
              >
                <Play className="size-3" />
                {lang === "ar" ? "أو ابدأ من البداية" : "Or start from the beginning"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Description + track list */}
      <div className="haki-container grid gap-10 py-10 lg:grid-cols-[1fr_360px]">
        <div>
          <h2 className="text-lg font-extrabold">{lang === "ar" ? "عن هذا المحتوى" : "About"}</h2>
          <p className="mt-3 leading-loose text-muted-foreground">{item.description}</p>
        </div>

        {(hasChapters || hasEpisodes) && (
          <aside>
            <h2 className="text-lg font-extrabold">
              {hasChapters ? t("chapters") : t("episodes")}
            </h2>
            <ol className="mt-4 space-y-1.5">
              {(trackList ?? []).map((ch: any, i: number) => {
                const offset = offsets.get(ch._id) ?? 0;
                const isCurrent =
                  player.track?.contentId === item._id && player.track?.title.includes(ch.title);
                return (
                  <li key={ch._id}>
                    <button
                      type="button"
                      onClick={() => startPlayback({ chapterId: ch._id })}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-start transition-colors hover:bg-muted",
                        isCurrent && "border-primary/50 bg-accent/50",
                      )}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-muted-foreground group-hover:bg-primary group-hover:text-white">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{ch.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(ch.duration)}
                        </span>
                      </span>
                      <Play className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                    </button>
                  </li>
                );
              })}
            </ol>
          </aside>
        )}
      </div>

      {/* Ratings & reviews */}
      <div className="haki-container pb-12">
        <RatingsSection contentId={item._id} />
      </div>
    </div>
  );
}
