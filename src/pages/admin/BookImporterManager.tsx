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
import { Switch } from "@/components/ui/switch";
import {
  BookOpen,
  Clock,
  CloudDownload,
  Globe,
  History,
  Link2,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Settings2,
  ShieldCheck,
  SkipForward,
  Tags,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { LOGO_COVER } from "@/lib/logoAsset";

type Tab = "import" | "queue" | "history" | "sources" | "mapping" | "settings";

const STATUS_BADGE: Record<string, { ar: string; cls: string }> = {
  pending: { ar: "منتظر", cls: "bg-muted text-muted-foreground" },
  processing: { ar: "قيد المعالجة", cls: "bg-blue-600 text-white" },
  imported: { ar: "مستورد", cls: "bg-indigo-600 text-white" },
  published: { ar: "منشور", cls: "bg-green-600 text-white" },
  draft: { ar: "مسودة", cls: "bg-amber-500 text-white" },
  requires_review: { ar: "يتطلب مراجعة", cls: "bg-orange-600 text-white" },
  failed: { ar: "فشل", cls: "bg-destructive text-white" },
  skipped: { ar: "تخطي", cls: "bg-muted text-muted-foreground" },
  duplicate: { ar: "موجود مسبقًا", cls: "bg-purple-600 text-white" },
};

const RIGHTS_LABEL: Record<string, { ar: string; cls: string }> = {
  public_domain: { ar: "ملك عام", cls: "bg-green-600 text-white" },
  copyrighted: { ar: "محفوظ الحقوق", cls: "bg-destructive text-white" },
  unknown: { ar: "غير معروف", cls: "bg-muted text-muted-foreground" },
  requires_review: { ar: "يتطلب مراجعة", cls: "bg-orange-600 text-white" },
};

export function BookImporterManager({
  L,
}: {
  L: (ar: string, en: string) => string;
}) {
  const [tab, setTab] = useState<Tab>("import");
  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "import", label: L("استيراد كتب", "Import books"), icon: CloudDownload },
    { key: "queue", label: L("طابور الاستيراد", "Import queue"), icon: Clock },
    { key: "history", label: L("سجل الاستيراد", "History"), icon: History },
    { key: "sources", label: L("المصادر", "Sources"), icon: Globe },
    { key: "mapping", label: L("ربط التصنيفات", "Category mapping"), icon: Tags },
    { key: "settings", label: L("إعدادات الاستيراد", "Import settings"), icon: Settings2 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-black">
          <BookOpen className="size-5 text-primary" />
          {L("مستورد الكتب", "Book Importer")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {L(
            "استيراد الكتب من مصادر الملك العام عبر واجهاتها الرسمية — مع التحقق من الحقوق قبل أي نشر تلقائي.",
            "Import public-domain books via official APIs — rights are verified before any auto-publish.",
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              "flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-colors " +
              (tab === t.key
                ? "bg-primary text-white"
                : "border bg-card text-muted-foreground hover:text-foreground")
            }
          >
            <t.icon className="size-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "import" && <ImportForm L={L} />}
      {tab === "queue" && <QueueView L={L} />}
      {tab === "history" && <HistoryView L={L} />}
      {tab === "sources" && <SourcesView L={L} />}
      {tab === "mapping" && <MappingView L={L} />}
      {tab === "settings" && (
        <div className="space-y-8">
          <SettingsView L={L} />
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-base font-black">
              <Clock className="size-4 text-primary" />
              {L("الاستيراد المجدول", "Scheduled imports")}
            </h3>
            <SchedulesView L={L} />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- 1. Import form ----------------

function ImportForm({ L }: { L: (ar: string, en: string) => string }) {
  const createJob = useMutation(api.bookImporter.createJob);
  const discover = useAction(api.bookImporter.discoverCandidates);
  const [source, setSource] = useState("internet_archive");
  const [mode, setMode] = useState<"single" | "ids" | "collection" | "search">("ids");
  const [input, setInput] = useState("");
  const [publishMode, setPublishMode] = useState("draft");
  const [busy, setBusy] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const job = useQuery(api.bookImporter.getJob, activeJobId ? { id: activeJobId as never } : "skip");

  const start = async () => {
    if (!input.trim()) return;
    setBusy(true);
    try {
      const jobId = await createJob({ source, mode, input, publishMode });
      setActiveJobId(jobId);
      const res: any = await discover({ jobId, source, mode, input });
      toast.success(L(`أُضيف ${res.count} كتاب للطابور`, `${res.count} books queued`));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-5 card-shadow">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{L("المصدر", "Source")}</Label>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="internet_archive">
                {L("أرشيف الإنترنت — كتب نصية وصوتية (المصدر الرئيسي)", "Internet Archive — texts & audiobooks (primary)")}
              </SelectItem>
              <SelectItem value="gutenberg">{L("مشروع غوتنبرغ (ملك عام)", "Project Gutenberg (public domain)")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{L("نوع الإدخال", "Input type")}</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ids">{L("معرفات أو روابط كتب (سطر لكل كتاب)", "Book IDs or URLs (one per line)")}</SelectItem>
              <SelectItem value="collection">{L("رابط مجموعة (Collection URL)", "Collection URL")}</SelectItem>
              <SelectItem value="search">{L("رابط بحث أو كلمات بحث", "Search URL or query")}</SelectItem>
              <SelectItem value="single">{L("كتاب واحد (رابط/معرف)", "Single book (URL/ID)")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{L("سياسة النشر", "Publish policy")}</Label>
          <Select value={publishMode} onValueChange={setPublishMode}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">{L("مسودات دائمًا (مراجعة يدوية)", "Always drafts (manual review)")}</SelectItem>
              <SelectItem value="auto">{L("نشر تلقائي للملك العام فقط", "Auto-publish verified public-domain only")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>
          {mode === "collection"
            ? L("رابط المجموعة، مثال:", "Collection URL, e.g.:")
            : mode === "search"
              ? L("رابط البحث أو الكلمات، مثال:", "Search URL or query, e.g.:")
              : L("المعرفات/الروابط", "IDs / URLs")}
        </Label>
        {mode === "ids" || mode === "single" ? (
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={4}
            dir="ltr"
            placeholder={"https://archive.org/details/book-id-1\nbook-id-2\nbook-id-3"}
          />
        ) : (
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            dir="ltr"
            placeholder="https://archive.org/details/arabic_books  |  https://archive.org/search?query=poetry"
          />
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {L(
          "يدعم روابط أرشيف الإنترنت كلها: مجموعات أو بحث أو كتب مفردة — ويُنشر الملك العام تلقائيًا مع الفصول الصوتية وملفات القراءة.",
          "Any archive.org link works: collections, searches, or single items — public domain publishes automatically with audio chapters and readable files.",
        )}
      </p>

      <div className="flex items-center gap-2">
        <Button className="font-bold" disabled={busy || !input.trim()} onClick={start}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <CloudDownload className="size-4" />}
          {L("فحص المصدر وإنشاء الطابور", "Scan source & queue")}
        </Button>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-green-600" />
          {L("واجهات رسمية فقط · بدون تجاوز حماية", "Official APIs only · no protection bypass")}
        </span>
      </div>

      {job && <QueueView L={L} fixedJobId={activeJobId ?? undefined} job={job} />}
    </div>
  );
}

// ---------------- 2. Queue ----------------

function QueueView({
  L,
  fixedJobId,
  job: jobProp,
}: {
  L: (ar: string, en: string) => string;
  fixedJobId?: string;
  job?: any;
}) {
  const jobs = useQuery(api.bookImporter.listJobs, {});
  const [selected, setSelected] = useState<any>(null);
  const jobId: any = fixedJobId ?? selected ?? jobs?.[0]?._id ?? null;
  const job = jobProp ?? jobs?.find((j: any) => j._id === jobId);
  const items = useQuery(
    api.bookImporter.listJobItems,
    jobId ? { jobId: jobId as never } : "skip",
  );
  const setJobStatus = useMutation(api.bookImporter.setJobStatus);
  const cancelJob = useMutation(api.bookImporter.cancelJob);
  const deleteJob = useMutation(api.bookImporter.deleteJob);
  const skipItem = useMutation(api.bookImporter.skipItem);
  const retryItem = useMutation(api.bookImporter.retryItem);
  const publishItem = useMutation(api.bookImporter.publishItem);
  const [processing, setProcessing] = useState(false);
  const [preview, setPreview] = useState<any>(null);

  const fetchAction = useAction(api.bookImporter.fetchItemMetadata);
  const runNow = useAction(api.bookImporter.processBatchNow);
  const [continuous, setContinuous] = useState(false);

  /** Batch processor loop: fetch metadata (network) → finalize (mutation). */
  const runBatch = async () => {
    if (!jobId || !job) return;
    setProcessing(true);
    try {
      await setJobStatus({ id: jobId, status: "processing" });
      // Process a small batch per click to keep requests gentle.
      for (let i = 0; i < 3; i++) {
        const pending = (items ?? []).find((it: any) => it.status === "pending");
        if (!pending) break;
        await fetchAction({ itemId: pending._id, publishMode: job.publishMode });
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setProcessing(false);
    }
  };

  /**
   * Process the whole queue NOW: repeatedly calls the admin batch action
   * (same core the 5-minute cron uses) until nothing processable remains.
   * Each round handles up to 10 items; capped at 40 rounds per click.
   */
  const runContinuous = async () => {
    if (!jobId || !job) return;
    setContinuous(true);
    let total = 0;
    let published = 0;
    try {
      await setJobStatus({ id: jobId, status: "processing" });
      for (let round = 0; round < 40; round++) {
        const res: any = await runNow({ jobId, maxItems: 10 });
        total += res?.processed ?? 0;
        published += res?.published ?? 0;
        if (!res?.processed) break;
      }
      if (total > 0) {
        toast.success(
          L(
            `تمت معالجة ${total} عنصرًا فورًا${published ? ` ونشر ${published} تلقائيًا` : ""}`,
            `Processed ${total} items now${published ? ` · auto-published ${published}` : ""}`,
          ),
        );
      } else {
        toast.info(L("لا عناصر قابلة للمعالجة الآن", "Nothing left to process right now"));
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setContinuous(false);
    }
  };

  const pct = job && job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0;

  return (
    <div className="space-y-4">
      {!fixedJobId && (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={jobId ?? ""} onValueChange={setSelected}>
            <SelectTrigger className="w-72"><SelectValue placeholder={L("اختر مهمة", "Select job")} /></SelectTrigger>
            <SelectContent>
              {(jobs ?? []).map((j: any) => (
                <SelectItem key={j._id} value={j._id}>
                  {j.input.slice(0, 40)} · {j.total}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {job && job.status === "processing" && (
            <>
              <Button size="sm" className="font-bold" disabled={continuous || processing} onClick={runContinuous}>
                {continuous ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
                {L("معالجة فورية", "Process now")}
              </Button>
              <Button size="sm" variant="outline" disabled={continuous || processing} onClick={runBatch}>
                {processing ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                {L("معالجة دفعة", "Process batch")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setJobStatus({ id: jobId, status: "paused" })}>
                <Pause className="size-4" />
                {L("إيقاف مؤقت", "Pause")}
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => cancelJob({ id: jobId })}>
                <X className="size-4" />
                {L("إلغاء", "Cancel")}
              </Button>
            </>
          )}
          {job && (job.status === "completed" || job.status === "cancelled") && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { deleteJob({ id: jobId }); setSelected(null); }}>
              {L("حذف المهمة", "Delete job")}
            </Button>
          )}
          {job && job.status === "paused" && (
            <Button size="sm" className="font-bold" onClick={() => setJobStatus({ id: jobId, status: "processing" })}>
              <Play className="size-4" />
              {L("استئناف", "Resume")}
            </Button>
          )}
        </div>
      )}

      {fixedJobId && job && job.status === "processing" && (
        <>
          <Button size="sm" className="font-bold" disabled={continuous || processing} onClick={runContinuous}>
            {continuous ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
            {L("معالجة فورية", "Process now")}
          </Button>
          <Button size="sm" variant="outline" disabled={continuous || processing} onClick={runBatch}>
            {processing ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            {L("معالجة دفعة", "Process batch")}
          </Button>
        </>
      )}

      {/* Progress */}
      {job && (
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold">
              {L("تم", "Processed")} {job.processed} / {job.total}
            </span>
            <span className="tabular-nums text-muted-foreground">{pct}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-2 flex gap-3 text-[11px] text-muted-foreground">
            <span className="text-green-600">✓ {job.succeeded} {L("نجح", "ok")}</span>
            <span className="text-destructive">✕ {job.failed} {L("فشل", "failed")}</span>
          </div>
        </div>
      )}

      {/* Items */}
      {items === undefined ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : items.length === 0 ? (
        <p className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
          {L("الطابور فارغ", "Queue is empty")}
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((it: any) => {
            const badge = STATUS_BADGE[it.status] ?? STATUS_BADGE.pending;
            return (
              <div key={it._id} className="rounded-xl border bg-card p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{it.title ?? it.externalId}</p>
                    <p className="truncate text-xs text-muted-foreground" dir="ltr">
                      {it.author ?? "—"} · {it.externalId}
                    </p>
                    {it.error && <p className="mt-1 text-xs text-destructive">{it.error}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge className={badge.cls}>{L(badge.ar, it.status)}</Badge>
                    {it.status === "duplicate" && it.duplicateOf && (
                      <a
                        href={`/content/${it.duplicateOf}`}
                        className="text-xs font-bold text-primary hover:underline"
                      >
                        {L("عرض الموجود", "View existing")}
                      </a>
                    )}
                    {(it.status === "pending" || it.status === "failed") && fetchAction && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            if (it.status === "failed") await retryItem({ itemId: it._id });
                            await fetchAction({ itemId: it._id });
                          } catch (e: any) {
                            toast.error(e.message);
                          }
                        }}
                      >
                        <RefreshCw className="size-3.5" />
                        {it.status === "failed" ? L("إعادة", "Retry") : L("جلب", "Fetch")}
                      </Button>
                    )}
                    {(it.status === "requires_review" || it.status === "imported") && (
                      <Button size="sm" variant="outline" onClick={() => setPreview(it)}>
                        {L("مراجعة", "Review")}
                      </Button>
                    )}
                    {it.status === "pending" && (
                      <Button size="sm" variant="ghost" onClick={() => skipItem({ itemId: it._id })}>
                        <SkipForward className="size-3.5" />
                        {L("تخطي", "Skip")}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review dialog */}
      {preview && <ReviewDialog item={preview} L={L} onClose={() => setPreview(null)} />}
    </div>
  );
}

// ---------------- Review dialog ----------------

function ReviewDialog({
  item,
  L,
  onClose,
}: {
  item: any;
  L: (ar: string, en: string) => string;
  onClose: () => void;
}) {
  const meta = item.metadata ? JSON.parse(item.metadata) : {};
  const files: any[] = (() => {
    try {
      return item.fileUrls ? JSON.parse(item.fileUrls) : meta.files ?? [];
    } catch {
      return [];
    }
  })();
  const categories = useQuery(api.content.listCategories, {});
  const publishItem = useMutation(api.bookImporter.publishItem);
  const [title, setTitle] = useState(item.title ?? "");
  const [description, setDescription] = useState(meta.description ?? "");
  const [author, setAuthor] = useState(item.author ?? "");
  const [year, setYear] = useState(String(item.year ?? meta.originalYear ?? ""));
  const [categoryId, setCategoryId] = useState("");
  const [busy, setBusy] = useState(false);
  const rights = RIGHTS_LABEL[item.rightsStatus ?? "requires_review"] ?? RIGHTS_LABEL.requires_review;

  const doAction = async (publish: boolean) => {
    setBusy(true);
    try {
      await publishItem({
        itemId: item._id,
        publish,
        overrides: {
          title: title || undefined,
          description: description || undefined,
          author: author || undefined,
          year: year ? Number(year) : undefined,
          categoryId: categoryId ? (categoryId as never) : undefined,
        },
      });
      toast.success(
        publish
          ? L("تم الاستيراد والنشر", "Imported & published")
          : L("تم الحفظ كمسودة", "Saved as draft"),
      );
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="my-8 grid w-full max-w-2xl gap-5 rounded-3xl border bg-background p-6 lg:grid-cols-[200px_1fr]">
        <div className="space-y-3">
          <img
            src={item.coverUrl ?? LOGO_COVER}
            alt=""
            loading="lazy"
            className="aspect-[3/4] w-full rounded-xl border object-cover"
            onError={(e) => ((e.currentTarget as HTMLImageElement).src = LOGO_COVER)}
          />
          <Badge className={rights.cls}>{L(rights.ar, item.rightsStatus)}</Badge>
          {meta.rightsInfo && (
            <p className="text-[10px] leading-relaxed text-muted-foreground" dir="ltr">
              {meta.rightsInfo.slice(0, 120)}
            </p>
          )}
        </div>
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <h3 className="text-lg font-black">{L("مراجعة قبل النشر", "Review before publishing")}</h3>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="size-4" /></Button>
          </div>
          <div className="space-y-1.5">
            <Label>{L("العنوان", "Title")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{L("المؤلف", "Author")}</Label>
            <Input value={author} onChange={(e) => setAuthor(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{L("الوصف", "Description")}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{L("سنة النشر", "Year")}</Label>
              <Input value={year} onChange={(e) => setYear(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label>{L("تصنيف إضافي", "Extra category")}</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">—</SelectItem>
                  {(categories ?? []).map((c: any) => (
                    <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{L("الملفات المتاحة", "Available formats")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {(item.formats ?? []).map((f: string) => (
                <Badge key={f} variant="secondary" dir="ltr">{f}</Badge>
              ))}
              {files.length === 0 && (item.formats ?? []).length === 0 && (
                <span className="text-xs text-muted-foreground">{L("لا ملفات قابلة للتنزيل", "No downloadable files")}</span>
              )}
            </div>
            <div className="space-y-1">
              {files.slice(0, 4).map((f: any) => (
                <a
                  key={f.url}
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-xs font-semibold text-primary hover:underline"
                  dir="ltr"
                >
                  <Link2 className="me-1 inline size-3" />
                  {f.name}
                </a>
              ))}
            </div>
          </div>
          <p className="truncate text-[11px] text-muted-foreground" dir="ltr">
            {L("المصدر", "Source")}: {meta.sourceUrl ?? item.sourceUrl}
          </p>
          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button className="font-bold" disabled={busy} onClick={() => doAction(true)}>
              {L("استيراد ونشر", "Import & publish")}
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => doAction(false)}>
              {L("حفظ كمسودة", "Save as draft")}
            </Button>
            <Button variant="ghost" onClick={onClose}>{L("إلغاء", "Cancel")}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- 3. History ----------------

function HistoryView({ L }: { L: (ar: string, en: string) => string }) {
  const history = useQuery(api.bookImporter.listHistory, { limit: 100 });
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b bg-secondary/60 text-xs text-muted-foreground">
              <th className="p-3 text-start font-semibold">{L("الكتاب", "Book")}</th>
              <th className="p-3 text-start font-semibold">{L("المصدر", "Source")}</th>
              <th className="p-3 text-start font-semibold">{L("الحالة", "Status")}</th>
              <th className="p-3 text-start font-semibold">{L("بواسطة", "By")}</th>
              <th className="p-3 text-start font-semibold">{L("التاريخ", "Date")}</th>
              <th className="p-3 text-start font-semibold">{L("خطأ", "Error")}</th>
            </tr>
          </thead>
          <tbody>
            {history === undefined ? (
              <tr><td colSpan={6} className="p-6 text-center"><Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" /></td></tr>
            ) : history.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">{L("لا سجل بعد", "No history yet")}</td></tr>
            ) : (
              history.map((h: any) => {
                const badge = STATUS_BADGE[h.status] ?? STATUS_BADGE.pending;
                return (
                  <tr key={h._id} className="border-b last:border-0">
                    <td className="max-w-[220px] truncate p-3 font-semibold">{h.title ?? h.externalId}</td>
                    <td className="p-3 text-muted-foreground">{h.source}</td>
                    <td className="p-3"><Badge className={badge.cls}>{L(badge.ar, h.status)}</Badge></td>
                    <td className="p-3 text-muted-foreground">{h.importedByName ?? "—"}</td>
                    <td className="p-3 tabular-nums text-muted-foreground" dir="ltr">
                      {new Date(h.createdAt).toISOString().slice(0, 10)}
                    </td>
                    <td className="max-w-[180px] truncate p-3 text-xs text-destructive">{h.error ?? "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------- 4. Sources ----------------

function SourcesView({ L }: { L: (ar: string, en: string) => string }) {
  const listSources = useAction(api.importSources.listSources);
  const [sources, setSources] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (sources === null && !error) {
    listSources({})
      .then(setSources)
      .catch((e) => setError(e.message));
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {sources === null ? (
        <Skeleton className="h-32 rounded-2xl" />
      ) : (
        sources.map((s: any) => (
          <div key={s.key} className="rounded-2xl border bg-card p-5 card-shadow">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="flex items-center gap-2 font-black">
                  <Globe className="size-4 text-primary" />
                  {s.name}
                  <Badge className="bg-green-600 text-white">{L("مفعّل", "Active")}</Badge>
                </p>
                <p className="mt-1 text-xs text-muted-foreground" dir="ltr">{s.searchEndpoint}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-muted px-2.5 py-1 font-bold" dir="ltr">
                  {s.rateLimitPerMin}/min
                </span>
                <span className="rounded-full bg-muted px-2.5 py-1 font-bold">{L("API رسمي", "Official API")}</span>
                {!s.requiresAuth && (
                  <span className="rounded-full bg-muted px-2.5 py-1 font-bold">{L("بدون مفاتيح", "No keys")}</span>
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {s.allowedFormats.map((f: string) => (
                <Badge key={f} variant="secondary" dir="ltr">{f}</Badge>
              ))}
            </div>
          </div>
        ))
      )}
      <p className="rounded-xl bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
        {L(
          "لإضافة مصدر جديد لاحقًا: أضف كائن تعريف في سجل المصادر (نقاط النهاية، حقل الحقوق، المعرّف، الحدود) — والمحرك كله سيعمل معه بدون تغيير.",
          "To add a source later: add one config object to the registry (endpoints, rights field, id field, limits) — the whole engine works with it unchanged.",
        )}
      </p>
    </div>
  );
}

// ---------------- 5. Category mapping ----------------

function MappingView({ L }: { L: (ar: string, en: string) => string }) {
  const mappings = useQuery(api.bookImporter.listCategoryMappings, {});
  const categories = useQuery(api.content.listCategories, {});
  const upsert = useMutation(api.bookImporter.upsertCategoryMapping);
  const remove = useMutation(api.bookImporter.deleteCategoryMapping);
  const [subject, setSubject] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await upsert({ subject, categoryId: categoryId as never });
      toast.success(L("تم الحفظ", "Saved"));
      setSubject("");
      setCategoryId("");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="grid gap-3 rounded-2xl border bg-card p-5 sm:grid-cols-[1fr_1fr_auto]">
        <div className="space-y-1.5">
          <Label>{L("موضوع من المصدر", "Source subject")}</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} required placeholder="poetry / history / fiction…" dir="ltr" />
        </div>
        <div className="space-y-1.5">
          <Label>{L("تصنيف حكي", "HAKI category")}</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger><SelectValue placeholder={L("اختر", "Select")} /></SelectTrigger>
            <SelectContent>
              {(categories ?? []).map((c: any) => (
                <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button type="submit" className="font-bold">{L("ربط", "Map")}</Button>
        </div>
      </form>
      <div className="space-y-2">
        {mappings === undefined ? (
          <Skeleton className="h-24 rounded-2xl" />
        ) : mappings.length === 0 ? (
          <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
            {L("لا روابط بعد — مثال: poetry → الشعر", "No mappings yet — e.g. poetry → الشعر")}
          </p>
        ) : (
          mappings.map((m: any) => (
            <div key={m._id} className="flex items-center justify-between rounded-xl border bg-card px-4 py-2.5">
              <p className="text-sm">
                <span className="rounded bg-muted px-2 py-0.5 font-bold" dir="ltr">{m.subject}</span>
                <span className="mx-2 text-muted-foreground">→</span>
                <span className="font-bold">{m.categoryName}</span>
              </p>
              <Button variant="ghost" size="icon" onClick={() => remove({ id: m._id })}>×</Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ---------------- 6. Settings ----------------

function SettingsView({ L }: { L: (ar: string, en: string) => string }) {
  const settings = useQuery(api.bookImporter.getImportSettings, {});
  const save = useMutation(api.bookImporter.setImportSettings);
  const [batch, setBatch] = useState("5");
  const [publishMode, setPublishMode] = useState("draft");
  const [minRights, setMinRights] = useState("requires_review");
  const [formats, setFormats] = useState("pdf, epub, txt");
  const [saved, setSaved] = useState(false);

  if (settings && !saved) {
    setBatch(String(settings.batchSize));
    setPublishMode(settings.publishMode);
    setMinRights(settings.minRights);
    setFormats((settings.allowedFormats ?? []).join(", "));
    setSaved(true);
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await save({
        batchSize: Number(batch),
        publishMode,
        minRights,
        allowedFormats: formats.split(",").map((f) => f.trim()).filter(Boolean),
      });
      toast.success(L("تم حفظ الإعدادات", "Settings saved"));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-xl space-y-4 rounded-2xl border bg-card p-6">
      <div className="space-y-1.5">
        <Label>{L("حجم الدفعة لكل نقرة معالجة (1-25)", "Batch size per processing click (1-25)")}</Label>
        <Input type="number" min={1} max={25} value={batch} onChange={(e) => setBatch(e.target.value)} dir="ltr" />
      </div>
      <div className="space-y-1.5">
        <Label>{L("سياسة النشر الافتراضية", "Default publish policy")}</Label>
        <Select value={publishMode} onValueChange={setPublishMode}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">{L("مسودات دائمًا", "Always drafts")}</SelectItem>
            <SelectItem value="auto">{L("نشر تلقائي للملك العام الموثق فقط", "Auto-publish verified PD only")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>{L("أدنى مستوى تحقق من الحقوق للنشر التلقائي", "Minimum rights level for auto-publish")}</Label>
        <Select value={minRights} onValueChange={setMinRights}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="public_domain">{L("ملك عام موثق فقط", "Verified public domain only")}</SelectItem>
            <SelectItem value="requires_review">{L("يتطلب مراجعة بشرية", "Human review required")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>{L("الصيغ المسموحة", "Allowed formats")}</Label>
        <Input value={formats} onChange={(e) => setFormats(e.target.value)} dir="ltr" />
      </div>
      <Button type="submit" className="font-bold">{L("حفظ", "Save")}</Button>
    </form>
  );
}

// ---------------- 6b. Scheduled imports ----------------

function SchedulesView({ L }: { L: (ar: string, en: string) => string }) {
  const schedules = useQuery(api.bookImporter.listSchedules, {});
  const createSchedule = useMutation(api.bookImporter.createSchedule);
  const setEnabled = useMutation(api.bookImporter.setScheduleEnabled);
  const removeSchedule = useMutation(api.bookImporter.deleteSchedule);
  const [name, setName] = useState("");
  const [input, setInput] = useState("");
  const [limitPerRun, setLimitPerRun] = useState("20");
  const [frequency, setFrequency] = useState("daily");
  const [scheduleSource, setScheduleSource] = useState("internet_archive");
  const [publishMode, setPublishMode] = useState("draft");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createSchedule({
        name,
        source: scheduleSource,
        mode: "collection",
        input,
        limitPerRun: Number(limitPerRun) || 20,
        frequency,
        publishMode,
        minRights: publishMode === "auto" ? "public_domain" : "requires_review",
      });
      toast.success(L("تم إنشاء الجدولة", "Schedule created"));
      setName("");
      setInput("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="grid gap-3 rounded-2xl border bg-card p-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{L("اسم الجدولة", "Schedule name")}</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>{L("المصدر", "Source")}</Label>
          <Select value={scheduleSource} onValueChange={setScheduleSource}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="internet_archive">{L("أرشيف الإنترنت — كتب وأعمال صوتية", "Internet Archive — books & audiobooks")}</SelectItem>
              <SelectItem value="gutenberg">{L("غوتنبرغ — كل الكتب ملك عام", "Gutenberg — all books public domain")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{scheduleSource === "gutenberg" ? L("مدخل الجلب (لغة أو كلمات بحث)", "Pull query (language or keywords)") : L("رابط المجموعة (IA)", "Collection URL (IA)")}</Label>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            required
            dir="ltr"
            placeholder={scheduleSource === "gutenberg" ? "languages=en  |  languages=ar" : "librivoxaudio AND mediatype:audio  |  collection:gutenberg  |  https://archive.org/details/arabic_books"}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{L("عدد الكتب لكل تشغيل", "Books per run")}</Label>
          <Input type="number" min={1} max={200} value={limitPerRun} onChange={(e) => setLimitPerRun(e.target.value)} dir="ltr" />
        </div>
        <div className="space-y-1.5">
          <Label>{L("التكرار", "Frequency")}</Label>
          <Select value={frequency} onValueChange={setFrequency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">{L("يوميًا", "Daily")}</SelectItem>
              <SelectItem value="weekly">{L("أسبوعيًا", "Weekly")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{L("سياسة النشر", "Publish policy")}</Label>
          <Select value={publishMode} onValueChange={setPublishMode}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">{L("مسودات", "Drafts")}</SelectItem>
              <SelectItem value="auto">{L("نشر تلقائي (ملك عام موثق فقط)", "Auto (verified PD only)")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button type="submit" className="font-bold" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Clock className="size-4" />}
            {L("إنشاء جدولة", "Create schedule")}
          </Button>
        </div>
      </form>

      <div className="space-y-2">
        {schedules === undefined ? (
          <Skeleton className="h-24 rounded-2xl" />
        ) : schedules.length === 0 ? (
          <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
            {L(
              "لا جداول بعد — تعمل الجدولة خلفيًا كل 6 ساعات دون حجب اللوحة",
              "No schedules yet — runs in the background every 6h without blocking the dashboard",
            )}
          </p>
        ) : (
          schedules.map((s: any) => (
            <div key={s._id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-4 py-3">
              <div>
                <p className="text-sm font-bold">{s.name}</p>
                <p className="truncate text-xs text-muted-foreground" dir="ltr">{s.input}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary">{s.frequency === "weekly" ? L("أسبوعي", "Weekly") : L("يومي", "Daily")}</Badge>
                <Badge variant="secondary">{s.limitPerRun} {L("كتاب/تشغيل", "books/run")}</Badge>
                <Badge className={s.publishMode === "auto" ? "bg-green-600 text-white" : "bg-amber-500 text-white"}>
                  {s.publishMode === "auto" ? L("نشر تلقائي", "Auto") : L("مسودات", "Drafts")}
                </Badge>
                <Switch checked={s.enabled} onCheckedChange={(v) => setEnabled({ id: s._id, enabled: v })} />
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeSchedule({ id: s._id })}>×</Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
