import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  BookOpen,
  ChevronRight,
  Layers,
  Link2,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  SkipForward,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { LOGO_COVER } from "@/lib/logoAsset";

type LFn = (ar: string, en: string) => string;

const STATUS_BADGE: Record<string, { ar: string; cls: string }> = {
  pending: { ar: "بانتظار التحليل", cls: "bg-muted text-muted-foreground" },
  processing: { ar: "قيد التحليل", cls: "bg-blue-600 text-white" },
  analyzed: { ar: "جاهز للمراجعة", cls: "bg-indigo-600 text-white" },
  imported: { ar: "مستورد", cls: "bg-green-600 text-white" },
  published: { ar: "منشور", cls: "bg-green-600 text-white" },
  draft: { ar: "مسودة", cls: "bg-amber-500 text-white" },
  requires_review: { ar: "يحتاج مراجعة", cls: "bg-orange-600 text-white" },
  failed: { ar: "فشل", cls: "bg-destructive text-white" },
  skipped: { ar: "متجاهل", cls: "bg-muted text-muted-foreground" },
  duplicate: { ar: "مكرر", cls: "bg-purple-600 text-white" },
};

const RIGHTS_BADGE: Record<string, { ar: string; cls: string }> = {
  public_domain: { ar: "ملك عام موثق", cls: "bg-green-600 text-white" },
  requires_review: { ar: "حقوق تحتاج مراجعة", cls: "bg-orange-600 text-white" },
  copyrighted: { ar: "محفوظ الحقوق", cls: "bg-destructive text-white" },
  unknown: { ar: "حقوق غير موثقة", cls: "bg-muted text-muted-foreground" },
};

function fmtBytes(n?: number): string {
  if (!n || n <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function parseMeta(m?: string): any {
  try {
    return m ? JSON.parse(m) : null;
  } catch {
    return null;
  }
}

function parseFiles(f?: string): any[] {
  try {
    return f ? JSON.parse(f) : [];
  } catch {
    return [];
  }
}

// ============================================================
// Book Importer — real data-entry tool:
// الصق الرابط → تحليل فعلي → مراجعة → استيراد جماعي للموقع
// ============================================================

export function BookImporterManager({ L }: { L: LFn }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-black">
          <BookOpen className="size-5 text-primary" />
          {L("مستورد الكتب", "Book Importer")}
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          {L(
            "الصق رابط مجموعة أو كتاب من أرشيف الإنترنت أو غوتنبرغ — يقرأ النظام الصفحة فعليًا، يستخرج البيانات والملفات والأغلفة، ثم تراجع وتستورد للموقع بضغطة واحدة.",
            "Paste a collection or book link from Internet Archive or Gutenberg — the system reads the real page, extracts metadata, files and covers, then you review and import to the site in one click.",
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            [1, L("الرابط والتحليل", "URL & analyze")],
            [2, L("المراجعة والاختيار", "Review & select")],
            [3, L("الاستيراد والسجل", "Import & history")],
          ] as const
        ).map(([n, label]) => (
          <button
            key={n}
            type="button"
            onClick={() => (n === 1 || activeJobId ? setStep(n as 1 | 2 | 3) : undefined)}
            className={
              "flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-colors " +
              (step === n
                ? "bg-primary text-white"
                : "border bg-card text-muted-foreground hover:text-foreground")
            }
          >
            <span
              className={
                "flex size-4 items-center justify-center rounded-full text-[10px] " +
                (step === n ? "bg-white/25" : "bg-muted")
              }
            >
              {n}
            </span>
            {label}
          </button>
        ))}
      </div>

      {step === 1 && (
        <AnalyzeStep
          L={L}
          onAnalyzed={(jobId) => {
            setActiveJobId(jobId);
            setStep(2);
          }}
        />
      )}
      {step === 2 && activeJobId && (
        <ReviewStep L={L} jobId={activeJobId} onDone={() => setStep(3)} />
      )}
      {step === 3 && (
        <HistoryStep
          L={L}
          onOpenJob={(id) => {
            setActiveJobId(id);
            setStep(2);
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// Step 1 — Paste URL → Analyze (real discovery + extraction)
// ============================================================

function AnalyzeStep({ L, onAnalyzed }: { L: LFn; onAnalyzed: (jobId: string) => void }) {
  const [url, setUrl] = useState("");
  const [publishMode, setPublishMode] = useState("auto");
  const [busy, setBusy] = useState(false);
  const [moreBusy, setMoreBusy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  const analyze = useAction(api.bookImporter.analyzeUrl);
  const discoverMore = useAction(api.bookImporter.discoverMore);
  const analyzeBatch = useAction(api.bookImporter.analyzeBatch);
  const job = useQuery(api.bookImporter.getJob, jobId ? { id: jobId as never } : "skip");

  // Auto-analyze loop: extract metadata in batches of 10 until none pending.
  // Errors are surfaced to the employee, never swallowed.
  const runExtraction = async (id: string) => {
    let extracted = 0;
    let failedRounds = 0;
    let lastError: string | null = null;
    for (let round = 0; round < 30; round++) {
      try {
        const r: any = await analyzeBatch({ jobId: id as never, maxItems: 10 });
        if (!r?.analyzed) break;
        extracted += r.analyzed;
      } catch (e: any) {
        failedRounds += 1;
        lastError = e?.message ?? String(e);
        break;
      }
    }
    return { extracted, failedRounds, lastError };
  };

  const start = async () => {
    if (!url.trim()) {
      toast.error(L("أدخل رابطًا أولًا", "Enter a URL first"));
      return;
    }
    setBusy(true);
    try {
      const res: any = await analyze({ url: url.trim(), publishMode });
      setJobId(res.jobId);
      toast.success(
        L(
          `اكتُشف ${res.discovered} كتابًا (${Number(res.total).toLocaleString()} إجمالًا في المصدر) — جارٍ استخراج البيانات…`,
          `Discovered ${res.discovered} books (${Number(res.total).toLocaleString()} total in source) — extracting…`,
        ),
      );
      const sum = await runExtraction(res.jobId);
      if (sum.failedRounds > 0 && sum.lastError) {
        toast.error(L(`فشل الاستخراج: ${sum.lastError}`, `Extraction failed: ${sum.lastError}`));
      }
      if (sum.extracted > 0) {
        toast.success(
          L(
            `استُخرجت بيانات ${sum.extracted} كتاب — تابع للمراجعة`,
            `Extracted ${sum.extracted} books — continue to review`,
          ),
        );
      }
    } catch (e: any) {
      toast.error(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const loadMore = async () => {
    if (!jobId) return;
    setMoreBusy(true);
    try {
      const r: any = await discoverMore({ jobId: jobId as never });
      if (r.added > 0) {
        toast.success(L(`أُضيف ${r.added} كتاب (صفحة ${r.page})`, `Added ${r.added} (page ${r.page})`));
        void runExtraction(jobId).catch(() => undefined);
      } else {
        toast.info(L("لا نتائج إضافية — وصلنا لآخر الصفحات", "No more results — last page reached"));
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setMoreBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-4 rounded-2xl border bg-card p-5 card-shadow">
        <div className="space-y-1.5">
          <Label>{L("رابط المجموعة أو الكتاب", "Collection or book URL")}</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              dir="ltr"
              placeholder={'https://archive.org/details/gutenberg?and[]=language:"English"'}
              className="flex-1 font-mono text-sm"
            />
            <Button className="font-bold" disabled={busy || !url.trim()} onClick={start}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
              {L("بدء الاستيراد", "Start import")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground" dir="ltr">
            archive.org/details/… · archive.org/search?query=… · gutenberg.org/ebooks/… · openlibrary.org/works/…
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{L("سياسة النشر", "Publish policy")}</Label>
            <Select value={publishMode} onValueChange={setPublishMode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">
                  {L("مسودات (مراجعة قبل الظهور بالموقع)", "Drafts (review before site)")}
                </SelectItem>
                <SelectItem value="auto">
                  {L("نشر مباشر للملك العام الموثق", "Direct publish for verified PD")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {job?.mode !== "item" && (
            <Button variant="outline" disabled={!jobId || moreBusy} onClick={loadMore}>
              {moreBusy ? <Loader2 className="size-4 animate-spin" /> : <Layers className="size-4" />}
              {L("تحميل 50 كتابًا إضافيًا", "Load 50 more books")}
            </Button>
            )}
            <Button className="font-bold" disabled={!jobId} onClick={() => jobId && onAnalyzed(jobId)}>
              {L("متابعة للمراجعة", "Continue to review")}
              <ChevronRight className="size-4 rotate-180" />
            </Button>
          </div>
        </div>

        {job && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-muted/60 p-3 text-xs">
            <Badge variant="secondary">{L("الحالة", "Status")}: {job.status}</Badge>
            <span>{L("مكتشف", "Discovered")}: <b>{job.total}</b></span>
            <span>{L("في المصدر", "In source")}: <b>{(job.numFound ?? 0).toLocaleString()}</b></span>
            <span>{L("حُلّل", "Analyzed")}: <b>{job.processed}</b></span>
            {job.failed > 0 && <span className="text-destructive">{L("فشل", "Failed")}: {job.failed}</span>}
            <Badge className="bg-green-600 text-white">
              <Zap className="me-1 size-3" />
              {job.autoPublished ?? 0} {L("منشور", "published")}
            </Badge>
          </div>
        )}

        <p className="rounded-xl bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
          {L(
            "الاستخراج حقيقي عبر واجهات المصادر الرسمية: بيانات الكتاب، الملفات المتاحة (PDF/EPUB/TXT/MP3…)، الغلاف، والحقوق كما وردت في المصدر — الحقول غير المتوفرة تُترك فارغة للمراجعة.",
            "Extraction is real via official source APIs: metadata, available files (PDF/EPUB/TXT/MP3…), cover, and rights as stated by the source — missing fields stay empty for review.",
          )}
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Step 2 — Review cards: covers, files (selectable), bulk import
// ============================================================

function ReviewStep({ L, jobId, onDone }: { L: LFn; jobId: string; onDone: () => void }) {
  const job = useQuery(api.bookImporter.getJob, { id: jobId as never });
  const items = useQuery(api.bookImporter.listJobItems, { jobId: jobId as never });
  const importSelected = useAction(api.bookImporter.importSelected);
  const reanalyze = useAction(api.bookImporter.analyzeBatch);
  const retryItem = useMutation(api.bookImporter.retryItem);
  const skipItem = useMutation(api.bookImporter.skipItem);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fileSel, setFileSel] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<any>(null);

  const analyzed = useMemo(() => (items ?? []).filter((i: any) => i.status === "analyzed"), [items]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const i of items ?? []) c[i.status] = (c[i.status] ?? 0) + 1;
    return c;
  }, [items]);

  useEffect(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const it of analyzed) if (!next.has(it._id)) next.add(it._id);
      return next;
    });
  }, [analyzed]);

  const isFileSelected = (itemId: string, idx: number, def: boolean) =>
    fileSel[`${itemId}:${idx}`] ?? def;

  const runImport = async () => {
    const ids = [...selected];
    if (ids.length === 0) {
      toast.error(L("اختر كتابًا واحدًا على الأقل", "Select at least one book"));
      return;
    }
    setBusy(true);
    try {
      const r: any = await importSelected({ itemIds: ids as never });
      toast.success(
        L(
          `استُورد ${r.imported} · مكرر ${r.duplicates} · للمراجعة ${r.review} · فشل ${r.failed}`,
          `Imported ${r.imported} · dup ${r.duplicates} · review ${r.review} · failed ${r.failed}`,
        ),
      );
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const pct = job && job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-bold">
            {L("التحليل", "Analyzed")}: {job?.processed ?? 0} / {job?.total ?? 0}
          </span>
          <div className="flex flex-wrap gap-2 text-[11px]">
            {Object.entries(counts).map(([k, v]) => {
              const b = STATUS_BADGE[k];
              return (
                <Badge key={k} className={(b?.cls ?? "bg-muted") + " text-[10px]"}>
                  {b ? L(b.ar, k) : k}: {v}
                </Badge>
              );
            })}
          </div>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setSelected(new Set(analyzed.map((i: any) => i._id)))}>
          {L("تحديد الكل", "Select all")}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
          {L("إلغاء التحديد", "Deselect all")}
        </Button>
        <span className="text-xs text-muted-foreground">
          {L(`${selected.size} كتاب محدد`, `${selected.size} selected`)}
        </span>
        <div className="ms-auto">
          <Button className="font-bold" disabled={busy || selected.size === 0} onClick={runImport}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {L("استيراد المحدد للموقع", "Import selected")}
          </Button>
        </div>
      </div>

      {items === undefined ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : items.length === 0 ? (
        <p className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
          {L("لا كتب بعد", "No books yet")}
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {items.map((it: any) => {
            const badge = STATUS_BADGE[it.status] ?? STATUS_BADGE.pending;
            const meta = parseMeta(it.metadata);
            const files = parseFiles(it.fileUrls);
            const rights = RIGHTS_BADGE[it.rightsStatus ?? "unknown"] ?? RIGHTS_BADGE.unknown;
            const checked = selected.has(it._id);
            return (
              <div key={it._id} className="rounded-2xl border bg-card p-4 card-shadow">
                <div className="flex gap-3">
                  <div className="w-20 shrink-0 space-y-1">
                    {it.coverUrl ? (
                      <img
                        src={it.coverUrl}
                        alt=""
                        loading="lazy"
                        className="aspect-[3/4] w-full rounded-lg border object-cover"
                        onError={(e) => ((e.currentTarget as HTMLImageElement).style.opacity = "0.15")}
                      />
                    ) : (
                      <div className="flex aspect-[3/4] w-full items-center justify-center rounded-lg border bg-muted text-[9px] text-muted-foreground">
                        {L("لا غلاف", "—")}
                      </div>
                    )}
                    {!it.coverUrl && (
                      <p className="text-center text-[9px] text-muted-foreground">
                        {L("Cover not found", "Cover not found")}
                      </p>
                    )}
                    {it.status === "analyzed" && (
                      <label className="flex cursor-pointer items-center justify-center gap-1 text-[10px] font-bold">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setSelected((prev) => {
                              const n = new Set(prev);
                              if (e.target.checked) n.add(it._id);
                              else n.delete(it._id);
                              return n;
                            })
                          }
                        />
                        {L("استيراد", "Import")}
                      </label>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-sm font-black">{it.title ?? it.externalId}</p>
                      <Badge className={badge.cls + " shrink-0 text-[10px]"}>{L(badge.ar, it.status)}</Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {it.author ?? "—"} {it.language ? `· ${it.language}` : ""} {it.year ? `· ${it.year}` : ""}
                    </p>
                    {meta?.description && (
                      <p className="line-clamp-2 text-[11px] text-muted-foreground">{meta.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge className={rights.cls + " text-[10px]"}>
                        {it.rightsStatus === "public_domain" ? (
                          <ShieldCheck className="me-1 size-3" />
                        ) : (
                          <ShieldAlert className="me-1 size-3" />
                        )}
                        {L(rights.ar, it.rightsStatus ?? "unknown")}
                      </Badge>
                      {(it.formats ?? []).slice(0, 6).map((f: string) => (
                        <Badge key={f} variant="secondary" className="text-[10px]" dir="ltr">
                          {f}
                        </Badge>
                      ))}
                    </div>
                    <p className="truncate text-[10px] text-muted-foreground" dir="ltr">
                      <Link2 className="me-1 inline size-3" />
                      {meta?.sourceUrl ?? it.externalId}
                    </p>

                    {files.length > 0 && (
                      <details className="rounded-lg border bg-muted/40 p-2">
                        <summary className="cursor-pointer text-[11px] font-bold">
                          {L(`الملفات (${files.length})`, `Files (${files.length})`)}
                        </summary>
                        <div className="mt-1.5 max-h-40 space-y-1 overflow-y-auto">
                          {files.map((f: any, fi: number) => (
                            <div key={f.url} className="flex items-center gap-2 text-[10px]">
                              <input
                                type="checkbox"
                                checked={isFileSelected(it._id, fi, f.selected)}
                                onChange={(e) => setFileSel((p) => ({ ...p, [`${it._id}:${fi}`]: e.target.checked }))}
                              />
                              <Badge variant="secondary" className="text-[9px]">{f.format}</Badge>
                              <span className="truncate" dir="ltr">{f.name}</span>
                              <span className="shrink-0 text-muted-foreground">{fmtBytes(f.size)}</span>
                              <a
                                href={f.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 font-bold text-primary hover:underline"
                              >
                                {L("تحميل", "DL")}
                              </a>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                    {it.status === "analyzed" && files.length === 0 && (
                      <p className="text-[10px] text-orange-600">
                        {L("لا توجد ملفات قابلة للتنزيل من المصدر", "No downloadable files at source")}
                      </p>
                    )}
                    {it.error && <p className="text-[10px] text-destructive">{it.error}</p>}

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(it.status === "pending" || it.status === "failed") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            try {
                              if (it.status === "failed") await retryItem({ itemId: it._id });
                              const r: any = await reanalyze({ jobId: jobId as never, maxItems: 25 });
                              toast.success(
                                L(
                                  `أُعيد التحليل: ${r?.analyzed ?? 0} — بقيت ${r?.remaining ?? 0}`,
                                  `Re-analyzed: ${r?.analyzed ?? 0} — ${r?.remaining ?? 0} left`,
                                ),
                              );
                            } catch (e: any) {
                              toast.error(e?.message ?? String(e));
                            }
                          }}
                        >
                          <RefreshCw className="size-3.5" />
                          {L("إعادة", "Retry")}
                        </Button>
                      )}
                      {it.status === "pending" && (
                        <Button size="sm" variant="ghost" onClick={() => skipItem({ itemId: it._id })}>
                          <SkipForward className="size-3.5" />
                          {L("تجاهل", "Skip")}
                        </Button>
                      )}
                      {it.status === "duplicate" && it.duplicateOf && (
                        <a
                          href={`/content/${it.duplicateOf}`}
                          className="text-xs font-bold text-primary hover:underline"
                        >
                          {L("عرض الموجود", "View existing")}
                        </a>
                      )}
                    </div>
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

// ============================================================
// Step 3 — History + report
// ============================================================

function HistoryStep({ L, onOpenJob }: { L: LFn; onOpenJob: (id: string) => void }) {
  const history = useQuery(api.bookImporter.listHistory, { limit: 50 });
  const report = useQuery(api.bookImporter.importReport, {});
  const deleteJob = useMutation(api.bookImporter.deleteJob);

  const cells: [string, any, string][] = report
    ? [
        [L("اكتُشف", "Discovered"), report.discovered, "text-foreground"],
        [L("حُلّل", "Analyzed"), report.analyzed, "text-blue-600"],
        [L("استُورد", "Imported"), report.imported, "text-green-600"],
        [L("مكرر", "Duplicates"), report.duplicates, "text-purple-600"],
        [L("للمراجعة", "Needs review"), report.review, "text-orange-600"],
        [L("فشل", "Failed"), report.failed, "text-destructive"],
        [L("ملفات إلكترونية", "E-files"), report.electronic, "text-foreground"],
        [L("ملفات صوتية", "Audio files"), report.audio, "text-foreground"],
        [L("أغلفة", "Covers"), report.covers, "text-foreground"],
      ]
    : [];

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-card p-5 card-shadow">
        <h3 className="mb-3 flex items-center gap-2 text-base font-black">
          <Layers className="size-4 text-primary" />
          {L("تقرير الاستيراد الكلي", "Overall import report")}
        </h3>
        {!report ? (
          <Skeleton className="h-20 rounded-xl" />
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
            {cells.map(([label, v, cls]) => (
              <div key={label} className="rounded-xl border bg-muted/40 p-2.5 text-center">
                <p className={"text-lg font-black tabular-nums " + cls}>{v ?? 0}</p>
                <p className="text-[9px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b bg-secondary/60 text-xs text-muted-foreground">
              <th className="p-3 text-start font-semibold">{L("التاريخ", "Date")}</th>
              <th className="p-3 text-start font-semibold">{L("الرابط", "URL")}</th>
              <th className="p-3 text-start font-semibold">{L("مكتشف", "Found")}</th>
              <th className="p-3 text-start font-semibold">{L("استورد", "Imported")}</th>
              <th className="p-3 text-start font-semibold">{L("فشل", "Failed")}</th>
              <th className="p-3 text-start font-semibold">{L("المدة", "Duration")}</th>
              <th className="p-3 text-start font-semibold">{L("الحالة", "Status")}</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {history === undefined ? (
              <tr>
                <td colSpan={8} className="p-6 text-center">
                  <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
                </td>
              </tr>
            ) : history.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
                  {L("لا عمليات بعد", "No imports yet")}
                </td>
              </tr>
            ) : (
              history.map((h: any) => (
                <tr key={h._id} className="border-b last:border-0">
                  <td className="p-3 tabular-nums text-muted-foreground" dir="ltr">
                    {new Date(h.createdAt).toISOString().slice(0, 16).replace("T", " ")}
                  </td>
                  <td className="max-w-[240px] truncate p-3 font-mono text-xs" dir="ltr">
                    {h.input}
                  </td>
                  <td className="p-3 tabular-nums">{h.total}</td>
                  <td className="p-3 tabular-nums text-green-600">{h.autoPublished ?? 0}</td>
                  <td className="p-3 tabular-nums text-destructive">{h.failed}</td>
                  <td className="p-3 tabular-nums text-muted-foreground" dir="ltr">
                    {h.durationMs ? `${Math.round(h.durationMs / 1000)}s` : "—"}
                  </td>
                  <td className="p-3">
                    <Badge className={(STATUS_BADGE[h.status]?.cls ?? "bg-muted") + " text-[10px]"}>
                      {L(STATUS_BADGE[h.status]?.ar ?? h.status, h.status)}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => onOpenJob(h._id)}>
                        {L("فتح", "Open")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => deleteJob({ id: h._id })}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
