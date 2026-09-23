import { api } from "@/convex/_generated/api";
import { FileUpload } from "@/components/FileUpload";
import { TYPE_LABELS } from "@/components/ContentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { ListMusic, Plus, Save, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Admin manager for chapters (audiobooks/ebooks) and episodes
 * (drama/podcast/magazine/micro-drama) of a content item, with real
 * audio uploads to Convex storage.
 */
export function TracksManager({ L }: { L: (ar: string, en: string) => string }) {
  const { lang } = useLang();
  const items = useQuery(api.content.listAllForAdmin, {});
  const [contentId, setContentId] = useState<string | null>(null);

  const selected = items?.find((i) => i._id === contentId);
  const isChaptered =
    selected?.contentType === "audiobook" || selected?.contentType === "ebook";

  return (
    <div>
      <h2 className="text-xl font-black">{L("الفصول والحلقات", "Chapters & episodes")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {L(
          "اختر عملًا لإدارة فصوله أو حلقاته، وارفع ملف الصوت لكل فصل (MP3/M4A).",
          "Pick a title to manage its chapters or episodes, and upload audio per track (MP3/M4A).",
        )}
      </p>

      <div className="mt-5 max-w-sm space-y-1.5">
        <Label>{L("اختر العمل", "Pick content")}</Label>
        <select
          value={contentId ?? ""}
          onChange={(e) => setContentId(e.target.value || null)}
          className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
        >
          <option value="">{L("—", "—")}</option>
          {(items ?? []).map((i) => (
            <option key={i._id} value={i._id}>
              {i.title} — {TYPE_LABELS[i.contentType as keyof typeof TYPE_LABELS]?.[lang as "ar" | "en"] ?? i.contentType}
            </option>
          ))}
        </select>
      </div>

      {contentId && selected && (
        <div className="mt-6">
          {isChaptered ? (
            <ChaptersPanel contentId={contentId} L={L} />
          ) : (
            <EpisodesPanel contentId={contentId} L={L} />
          )}
        </div>
      )}
    </div>
  );
}

// ============ Chapters ============

function ChaptersPanel({ contentId, L }: { contentId: string; L: (ar: string, en: string) => string }) {
  const chapters = useQuery(api.content.listChapters, { contentId: contentId as any });
  const upsert = useMutation(api.adminContent.upsertChapter);
  const remove = useMutation(api.adminContent.deleteChapter);
  const saveAudioUpload = useMutation(api.files.saveAudio);
  const [draft, setDraft] = useState<{ id?: string; number: number; title: string; duration: number } | null>(null);

  const nextNumber = (chapters?.length ?? 0) + 1;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="font-extrabold">{L("الفصول", "Chapters")}</h3>
        <Button size="sm" onClick={() => setDraft({ number: nextNumber, title: "", duration: 0 })}>
          <Plus className="size-4" />
          {L("فصل جديد", "New chapter")}
        </Button>
      </div>

      {chapters === undefined ? (
        <Skeleton className="mt-4 h-32 rounded-xl" />
      ) : chapters.length === 0 ? (
        <p className="mt-4 rounded-xl border bg-secondary/50 p-6 text-center text-sm text-muted-foreground">
          {L("لا توجد فصول بعد — أضف أول فصل", "No chapters yet — add the first one")}
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {chapters.map((ch: any) => (
            <div
              key={ch._id}
              className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-bold">
                {ch.number}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{ch.title}</p>
                <p className="text-xs text-muted-foreground">
                  {ch.duration} {L("ثانية", "s")} · {ch.audioUrl ? L("ملف صوتي مرفوع ✓", "audio attached ✓") : L("بلا صوت", "no audio")}
                </p>
              </div>
              <FileUpload
                accept=".mp3,.m4a,audio/mpeg,audio/mp4,audio/*"
                label={L("صوت الفصل", "Chapter audio")}
                maxSizeMB={80}
                onUploaded={async (storageId) => {
                  try {
                    await saveAudioUpload({
                      storageId: storageId as any,
                      target: { kind: "chapter", chapterId: ch._id },
                    });
                    toast.success(L("تم رفع صوت الفصل", "Chapter audio uploaded"));
                  } catch (e: any) {
                    toast.error(e.message);
                  }
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDraft({ id: ch._id, number: ch.number, title: ch.title, duration: ch.duration })}
                aria-label={L("تعديل", "Edit")}
              >
                <Save className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                onClick={async () => {
                  if (!confirm(L("حذف هذا الفصل؟", "Delete this chapter?"))) return;
                  await remove({ id: ch._id });
                  toast.success(L("تم الحذف", "Deleted"));
                }}
                aria-label={L("حذف", "Delete")}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {draft && (
        <ChapterDraft
          draft={draft}
          contentId={contentId}
          L={L}
          onDone={() => setDraft(null)}
          upsert={upsert}
        />
      )}
    </div>
  );
}

function ChapterDraft({
  draft,
  contentId,
  L,
  onDone,
  upsert,
}: {
  draft: { id?: string; number: number; title: string; duration: number };
  contentId: string;
  L: (ar: string, en: string) => string;
  onDone: () => void;
  upsert: ReturnType<typeof useMutation<any>>;
}) {
  const [state, setState] = useState(draft);
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-4 rounded-xl border bg-secondary/40 p-4">
      <div className="grid gap-3 sm:grid-cols-[80px_1fr_120px_auto]">
        <div className="space-y-1">
          <Label>{L("#", "#")}</Label>
          <Input
            type="number"
            min={1}
            value={state.number}
            onChange={(e) => setState({ ...state, number: Number(e.target.value) })}
          />
        </div>
        <div className="space-y-1">
          <Label>{L("عنوان الفصل", "Chapter title")}</Label>
          <Input
            value={state.title}
            onChange={(e) => setState({ ...state, title: e.target.value })}
            placeholder={L("مثال: الفصل الأول — البداية", "e.g. Chapter 1 — The Beginning")}
          />
        </div>
        <div className="space-y-1">
          <Label>{L("المدة (ث)", "Duration (s)")}</Label>
          <Input
            type="number"
            min={0}
            value={state.duration}
            onChange={(e) => setState({ ...state, duration: Number(e.target.value) })}
          />
        </div>
        <div className="flex items-end gap-1.5">
          <Button
            disabled={busy || !state.title.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await upsert({
                  id: state.id as any,
                  contentId: contentId as any,
                  number: state.number,
                  title: state.title.trim(),
                  duration: state.duration,
                });
                toast.success(L("تم الحفظ", "Saved"));
                onDone();
              } catch (e: any) {
                toast.error(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Save className="size-4" />
            {L("حفظ", "Save")}
          </Button>
          <Button variant="ghost" onClick={onDone} aria-label={L("إلغاء", "Cancel")}>
            <X className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============ Episodes ============

function EpisodesPanel({ contentId, L }: { contentId: string; L: (ar: string, en: string) => string }) {
  const episodes = useQuery(api.content.listEpisodes, { contentId: contentId as any });
  const upsert = useMutation(api.adminContent.upsertEpisode);
  const remove = useMutation(api.adminContent.deleteEpisode);
  const saveAudioUpload = useMutation(api.files.saveAudio);
  const [draft, setDraft] = useState<{ id?: string; number: number; title: string; duration: number } | null>(null);

  const nextNumber = (episodes?.length ?? 0) + 1;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="font-extrabold">{L("الحلقات", "Episodes")}</h3>
        <Button size="sm" onClick={() => setDraft({ number: nextNumber, title: "", duration: 0 })}>
          <Plus className="size-4" />
          {L("حلقة جديدة", "New episode")}
        </Button>
      </div>

      {episodes === undefined ? (
        <Skeleton className="mt-4 h-32 rounded-xl" />
      ) : episodes.length === 0 ? (
        <p className="mt-4 rounded-xl border bg-secondary/50 p-6 text-center text-sm text-muted-foreground">
          {L("لا توجد حلقات بعد — أضف أول حلقة", "No episodes yet — add the first one")}
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {episodes.map((ep: any) => (
            <div
              key={ep._id}
              className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-bold">
                {ep.number}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{ep.title}</p>
                <p className="text-xs text-muted-foreground">
                  {ep.duration} {L("ثانية", "s")} · {ep.audioUrl ? L("ملف صوتي مرفوع ✓", "audio attached ✓") : L("بلا صوت", "no audio")}
                </p>
              </div>
              <FileUpload
                accept=".mp3,.m4a,audio/mpeg,audio/mp4,audio/*"
                label={L("صوت الحلقة", "Episode audio")}
                maxSizeMB={80}
                onUploaded={async (storageId) => {
                  try {
                    await saveAudioUpload({
                      storageId: storageId as any,
                      target: { kind: "episode", episodeId: ep._id },
                    });
                    toast.success(L("تم رفع صوت الحلقة", "Episode audio uploaded"));
                  } catch (e: any) {
                    toast.error(e.message);
                  }
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDraft({ id: ep._id, number: ep.number, title: ep.title, duration: ep.duration })}
                aria-label={L("تعديل", "Edit")}
              >
                <Save className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                onClick={async () => {
                  if (!confirm(L("حذف هذه الحلقة؟", "Delete this episode?"))) return;
                  await remove({ id: ep._id });
                  toast.success(L("تم الحذف", "Deleted"));
                }}
                aria-label={L("حذف", "Delete")}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {draft && (
        <ChapterDraft
          draft={draft}
          contentId={contentId}
          L={L}
          onDone={() => setDraft(null)}
          upsert={upsert}
        />
      )}
    </div>
  );
}
