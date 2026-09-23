import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLang } from "@/lib/i18n";
import { useMutation, useQuery } from "convex/react";
import { ExternalLink, FileAudio, FileText, Image as ImageIcon, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type MediaKind = "image" | "audio" | "document";

/**
 * Media library: every file uploaded to Convex storage (covers, audio MP3/M4A,
 * PDF/EPUB books, avatars) with type detection and open/delete actions.
 */
export function MediaLibrary({ L }: { L: (ar: string, en: string) => string }) {
  // Storage is a system table; read it via a small admin query.
  const files = useQuery(api.adminMedia.listFiles, {});
  const remove = useMutation(api.adminMedia.deleteFile);
  const { lang } = useLang();

  const kindOf = (contentType?: string): MediaKind => {
    if (!contentType) return "document";
    if (contentType.startsWith("image/")) return "image";
    if (contentType.startsWith("audio/")) return "audio";
    return "document";
  };

  const counts = (files ?? []).reduce(
    (acc, f) => {
      acc[kindOf((f as any).contentType)]++;
      return acc;
    },
    { image: 0, audio: 0, document: 0 } as Record<MediaKind, number>,
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">{L("مكتبة الوسائط", "Media library")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {L(
              "كل الملفات المرفوعة: الأغلفة، الصوتيات، وكتب PDF/EPUB.",
              "Every uploaded file: covers, audio, and PDF/EPUB books.",
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="rounded-full border px-3 py-1.5">
            <ImageIcon className="me-1 inline size-3.5 text-primary" />
            {counts.image} {L("صورة", "images")}
          </span>
          <span className="rounded-full border px-3 py-1.5">
            <FileAudio className="me-1 inline size-3.5 text-primary" />
            {counts.audio} {L("صوت", "audio")}
          </span>
          <span className="rounded-full border px-3 py-1.5">
            <FileText className="me-1 inline size-3.5 text-primary" />
            {counts.document} {L("مستندات", "documents")}
          </span>
        </div>
      </div>

      {files === undefined ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : files.length === 0 ? (
        <p className="mt-6 rounded-2xl border bg-secondary/50 p-10 text-center text-sm text-muted-foreground">
          {L("لا توجد ملفات مرفوعة بعد", "No files uploaded yet")}
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {files.map((f: any) => {
            const kind = kindOf(f.contentType);
            return (
              <div key={f._id} className="overflow-hidden rounded-2xl border bg-card card-shadow">
                <div className="flex h-28 items-center justify-center bg-secondary/50">
                  {kind === "image" && f.url ? (
                    <img src={f.url} alt="" loading="lazy" className="size-full object-cover" />
                  ) : kind === "audio" ? (
                    <FileAudio className="size-10 text-primary" />
                  ) : (
                    <FileText className="size-10 text-primary" />
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate text-xs font-bold" dir="ltr">
                    {f.contentType ?? "—"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatSize(f.size)} · {new Date(f.createdAt ?? Date.now()).toLocaleDateString(lang === "ar" ? "ar" : "en")}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5">
                    {f.url && (
                      <a href={f.url} target="_blank" rel="noopener noreferrer" tabIndex={0}>
                        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                          <ExternalLink className="size-3" />
                          {L("فتح", "Open")}
                        </Button>
                      </a>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs text-destructive"
                      onClick={async () => {
                        if (!confirm(L("حذف هذا الملف نهائيًا؟", "Delete this file permanently?"))) return;
                        try {
                          await remove({ storageId: f._id });
                          toast.success(L("تم الحذف", "Deleted"));
                        } catch (e: any) {
                          toast.error(e.message);
                        }
                      }}
                    >
                      <RefreshCw className="hidden" />
                      {L("حذف", "Delete")}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatSize(bytes?: number) {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
