import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  DEFAULT_TIMEZONE,
  isBlockingScheduleStatus,
  parseFormDateTime,
  scheduleStatusAr,
  zonedDateStr,
  zonedTimeStr,
  zonedToUtc,
} from "@/convex/scheduleLogic";
import { ContentTypeIcon, TYPE_LABELS } from "@/components/ContentCard";
import { LOGO_COVER } from "@/lib/logoAsset";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CalendarDays,
  CheckCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Eye,
  FileText,
  History,
  Info,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ---------------- local types & helpers ----------------

type ScheduleContent = {
  _id: string;
  title: string;
  slug: string;
  contentType: string;
  coverImage: string | null;
  status: string;
};

type ScheduleRow = Doc<"content_schedules"> & {
  content: ScheduleContent | null;
};

type ScheduleEventRow = Doc<"content_schedule_events"> & {
  scheduleStatus: string | null;
  scheduleAt: number | null;
  contentTitle: string | null;
  contentType: string | null;
};

type RecurrenceForm = {
  freq: "none" | "daily" | "weekly" | "monthly" | "interval_days";
  weekdays?: number[];
  intervalDays?: number;
  monthDay?: number;
  timeOfDay: string;
  endsAt?: number;
};

type LFn = (ar: string, en: string) => string;

const WEEKDAY_LABELS_AR = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function statusBadgeClass(status: string): string {
  switch (status) {
    case "draft":
      return "bg-amber-100 text-amber-700";
    case "scheduled":
      return "bg-blue-100 text-blue-700";
    case "publishing":
      return "bg-orange-100 text-orange-700 animate-pulse";
    case "published":
      return "bg-green-100 text-green-700";
    case "failed":
      return "bg-red-100 text-red-700";
    case "cancelled":
      return "bg-gray-100 text-gray-600";
    default:
      return "";
  }
}

function statusDotClass(status: string): string {
  switch (status) {
    case "scheduled":
      return "bg-blue-500";
    case "draft":
      return "bg-amber-500";
    case "publishing":
      return "bg-orange-500 animate-pulse";
    case "published":
      return "bg-green-500";
    case "failed":
      return "bg-red-500";
    default:
      return "bg-gray-400";
  }
}

function recLabel(rec: RecurrenceForm | undefined, L: LFn): string {
  if (!rec || rec.freq === "none") return L("بدون تكرار", "One-off");
  switch (rec.freq) {
    case "daily":
      return L("يوميًا", "Daily");
    case "weekly": {
      const days = (rec.weekdays ?? []).map((d) => WEEKDAY_LABELS_AR[d]).join("، ");
      return L("أسبوعيًا: ", "Weekly: ") + days;
    }
    case "monthly":
      return L(`شهريًا يوم ${rec.monthDay ?? 1}`, `Monthly on day ${rec.monthDay ?? 1}`);
    case "interval_days":
      return L(`كل ${rec.intervalDays ?? 1} أيام`, `Every ${rec.intervalDays ?? 1} days`);
    default:
      return rec.freq;
  }
}

function actionMeta(action: string): { label: string; icon: typeof Zap } {
  switch (action) {
    case "create":
      return { label: "إنشاء جدولة", icon: Plus };
    case "update":
      return { label: "تعديل", icon: Pencil };
    case "reschedule":
    case "bulk_reschedule":
      return { label: "تغيير الموعد", icon: Clock };
    case "publish_now":
    case "bulk_publish_now":
      return { label: "نشر فوري", icon: Zap };
    case "publish_success":
      return { label: "نُشر بنجاح", icon: CheckCircle2 };
    case "publish_failed":
      return { label: "فشل النشر", icon: XCircle };
    case "validation_error":
      return { label: "بيانات ناقصة", icon: AlertTriangle };
    case "retry":
      return { label: "إعادة محاولة", icon: RotateCcw };
    case "cancel":
    case "bulk_cancel":
      return { label: "إلغاء", icon: X };
    case "convert_draft":
      return { label: "تحويل إلى مسودة", icon: FileText };
    case "duplicate":
      return { label: "نسخ", icon: Copy };
    case "bulk_set_status":
      return { label: "تغيير الحالة", icon: Pencil };
    default:
      return { label: action, icon: Info };
  }
}

function ymdOf(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// ---------------- schedule card (drag source) ----------------

function ScheduleCard({
  s,
  L,
  onOpenEdit,
}: {
  s: ScheduleRow;
  L: LFn;
  onOpenEdit: (s: ScheduleRow) => void;
}) {
  const draggable =
    s.status === "scheduled" || s.status === "draft" || s.status === "failed";
  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/schedule-id", s._id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => onOpenEdit(s)}
      className={cn(
        "cursor-pointer rounded-lg border bg-card p-1.5 text-start shadow-sm transition-all hover:shadow-md",
        s.status === "failed" && "border-red-300 bg-red-50/60",
        s.status === "publishing" && "border-primary bg-primary/5",
        !draggable && "opacity-80",
      )}
      title={`${s.content?.title ?? ""} · ${zonedTimeStr(s.scheduledAt, s.timezone)}`}
    >
      <div className="flex items-center gap-1">
        <span className={cn("size-1.5 shrink-0 rounded-full", statusDotClass(s.status))} />
        <span className="text-[10px] font-bold tabular-nums text-muted-foreground" dir="ltr">
          {s.status === "published" && s.publishedAt
            ? zonedTimeStr(s.publishedAt, s.timezone)
            : zonedTimeStr(s.scheduledAt, s.timezone)}
        </span>
        <ContentTypeIcon
          type={s.content?.contentType ?? ""}
          className="ms-auto size-3 shrink-0 opacity-60"
        />
      </div>
      <p className="mt-0.5 truncate text-[11px] font-bold leading-tight">
        {s.content?.title ?? L("محتوى محذوف", "Deleted content")}
      </p>
    </div>
  );
}

// ---------------- conflict banner (conditional query) ----------------

function ConflictChecker({
  contentId,
  allowRepublish,
  onAllowRepublishChange,
  L,
}: {
  contentId: string;
  allowRepublish: boolean;
  onAllowRepublishChange: (v: boolean) => void;
  L: LFn;
}) {
  const conflict = useQuery(api.scheduler.checkConflict, {
    contentId: contentId as Id<"content">,
  });
  if (conflict === undefined) return null;
  if (!conflict.exists) return null;

  if (conflict.blocking && isBlockingScheduleStatus(conflict.blocking.status)) {
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm">
        <p className="flex items-center gap-1.5 font-bold text-red-700">
          <AlertTriangle className="size-4" />
          {L("تعارض جدولة", "Scheduling conflict")}
        </p>
        <p className="mt-1 text-red-700/90">
          {L("هذا المحتوى مجدول بالفعل", "This content already has an active schedule")} (
          {scheduleStatusAr(conflict.blocking.status)}){" "}
          {L("بتاريخ", "on")}{" "}
          <span dir="ltr" className="font-bold">
            {zonedDateStr(conflict.blocking.scheduledAt, conflict.blocking.timezone)}{" "}
            {zonedTimeStr(conflict.blocking.scheduledAt, conflict.blocking.timezone)}
          </span>
          .{" "}
          {L(
            "عدّل الجدولة القائمة أو ألغِها أولًا.",
            "Edit or cancel the existing schedule first.",
          )}
        </p>
      </div>
    );
  }

  if (conflict.contentStatus === "published") {
    return (
      <div className="rounded-xl border border-blue-300 bg-blue-50 p-3 text-sm">
        <p className="flex items-center gap-1.5 font-bold text-blue-700">
          <Info className="size-4" />
          {L("المحتوى منشور حاليًا", "Content is already published")}
        </p>
        <p className="mt-1 text-blue-700/90">
          {L(
            "لن يُنشأ نسخة مكررة — نفس المحتوى سيُعاد نشره في الموعد الجديد.",
            "No duplicate is created — the same content will be republished at the new time.",
          )}
        </p>
        <label className="mt-2 flex items-center gap-2 font-semibold text-blue-800">
          <Switch checked={allowRepublish} onCheckedChange={onAllowRepublishChange} />
          {L("أكّد إعادة الجدولة والنشر", "Confirm reschedule & republish")}
        </label>
      </div>
    );
  }
  return null;
}

// ---------------- create / edit dialog ----------------

function ScheduleDialog({
  L,
  editing,
  categories,
  contents,
  onClose,
}: {
  L: LFn;
  editing: ScheduleRow | null;
  categories: { _id: string; name: string }[] | undefined;
  contents: { _id: string; title: string; contentType: string; status: string }[];
  onClose: () => void;
}) {
  const createSchedule = useMutation(api.scheduler.createSchedule);
  const updateSchedule = useMutation(api.scheduler.updateSchedule);

  const isEdit = !!editing;
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [contentId, setContentId] = useState("");
  const [nc, setNc] = useState({
    title: "",
    slug: "",
    description: "",
    contentType: "audiobook",
    coverImage: "",
    keywordsText: "",
  });
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [date, setDate] = useState(
    editing
      ? zonedDateStr(editing.scheduledAt, editing.timezone)
      : zonedDateStr(Date.now() + 86_400_000, DEFAULT_TIMEZONE),
  );
  const [time, setTime] = useState(
    editing ? zonedTimeStr(editing.scheduledAt, editing.timezone) : "09:00",
  );
  const [timezone, setTimezone] = useState(editing?.timezone ?? DEFAULT_TIMEZONE);
  const [freq, setFreq] = useState<RecurrenceForm["freq"]>(
    (editing?.recurrence?.freq as RecurrenceForm["freq"]) ?? "none",
  );
  const [weekdays, setWeekdays] = useState<number[]>(
    (editing?.recurrence?.weekdays as number[] | undefined) ?? [],
  );
  const [intervalDays, setIntervalDays] = useState(editing?.recurrence?.intervalDays ?? 3);
  const [monthDay, setMonthDay] = useState(editing?.recurrence?.monthDay ?? 1);
  const [endsAtDate, setEndsAtDate] = useState("");
  const [status, setStatus] = useState<"scheduled" | "draft">(
    editing?.status === "draft" ? "draft" : "scheduled",
  );
  const [allowRepublish, setAllowRepublish] = useState(false);
  const [saving, setSaving] = useState(false);

  const tzValid = useMemo(() => {
    try {
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone.trim() || DEFAULT_TIMEZONE,
      });
      return true;
    } catch {
      return false;
    }
  }, [timezone]);

  // For the published-content confirm check we need the selected content row.
  const selectedContent = contents.find((c) => c._id === contentId);
  const conflictNeedsConfirm = selectedContent?.status === "published";

  const buildRecurrence = (): RecurrenceForm | undefined => {
    if (freq === "none") return undefined;
    const rec: RecurrenceForm = { freq, timeOfDay: time };
    if (freq === "weekly") rec.weekdays = weekdays;
    if (freq === "interval_days") rec.intervalDays = intervalDays;
    if (freq === "monthly") rec.monthDay = monthDay;
    if (endsAtDate && tzValid) {
      rec.endsAt = zonedToUtc(endsAtDate, "23:59", timezone.trim() || DEFAULT_TIMEZONE);
    }
    return rec;
  };

  const submit = async (targetStatus: "scheduled" | "draft") => {
    const dt = parseFormDateTime(date, time);
    if ("error" in dt) {
      toast.error(dt.error);
      return;
    }
    if (!tzValid) {
      toast.error(L("المنطقة الزمنية غير صالحة", "Invalid timezone"));
      return;
    }
    const recurrence = buildRecurrence();
    setSaving(true);
    try {
      if (isEdit && editing) {
        await updateSchedule({
          id: editing._id,
          date: dt.date,
          time: dt.time,
          timezone: timezone.trim() || DEFAULT_TIMEZONE,
          recurrence: (recurrence ?? { freq: "none", timeOfDay: dt.time }) as never,
        });
        toast.success(L("تم تحديث الجدولة", "Schedule updated"));
      } else {
        if (mode === "existing" && !contentId) {
          toast.error(L("اختر المحتوى المراد جدولته", "Pick content to schedule"));
          setSaving(false);
          return;
        }
        if (mode === "existing" && conflictNeedsConfirm && !allowRepublish) {
          toast.error(
            L(
              "المحتوى منشور — أكّد إعادة الجدولة أولًا",
              "Content is published — confirm republish first",
            ),
          );
          setSaving(false);
          return;
        }
        const keywords = nc.keywordsText
          .split(/[,،]/)
          .map((k) => k.trim())
          .filter(Boolean);
        await createSchedule({
          contentId: mode === "existing" ? (contentId as Id<"content">) : undefined,
          newContent:
            mode === "new"
              ? {
                  title: nc.title,
                  slug: nc.slug,
                  description: nc.description,
                  coverImage: nc.coverImage || undefined,
                  contentType: nc.contentType as never,
                  keywords: keywords.length > 0 ? keywords : undefined,
                  categoryIds:
                    selectedCats.length > 0 ? (selectedCats as Id<"categories">[]) : undefined,
                }
              : undefined,
          date: dt.date,
          time: dt.time,
          timezone: timezone.trim() || DEFAULT_TIMEZONE,
          status: targetStatus,
          recurrence: recurrence as never,
          allowRepublish: allowRepublish || undefined,
        });
        toast.success(
          targetStatus === "draft"
            ? L("حُفظت كمسودة جدولة", "Saved as draft schedule")
            : L("تمت الجدولة بنجاح", "Scheduled successfully"),
        );
      }
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-start text-lg font-black">
            <CalendarClock className="size-5 text-primary" />
            {isEdit
              ? L("تعديل جدولة", "Edit schedule")
              : L("جدولة نشر محتوى", "Schedule content publishing")}
          </DialogTitle>
          <DialogDescription className="text-start">
            {isEdit
              ? L(
                  "حدّث الموعد أو قاعدة التكرار. المنطقة الزمنية الافتراضية Africa/Cairo.",
                  "Update the time or recurrence. Default timezone: Africa/Cairo.",
                )
              : L(
                  "اختر محتوى موجودًا أو أنشئ محتوى جديدًا وحدد موعد نشره التلقائي.",
                  "Pick existing content or create new, then pick its publish time.",
                )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isEdit && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("existing")}
                className={cn(
                  "flex-1 rounded-xl border p-3 text-sm font-bold transition-colors",
                  mode === "existing"
                    ? "border-primary bg-primary/10 text-primary"
                    : "hover:bg-muted/50",
                )}
              >
                {L("محتوى موجود", "Existing content")}
              </button>
              <button
                type="button"
                onClick={() => setMode("new")}
                className={cn(
                  "flex-1 rounded-xl border p-3 text-sm font-bold transition-colors",
                  mode === "new"
                    ? "border-primary bg-primary/10 text-primary"
                    : "hover:bg-muted/50",
                )}
              >
                {L("إنشاء محتوى جديد", "Create new content")}
              </button>
            </div>
          )}

          {!isEdit && mode === "existing" && (
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label>{L("المحتوى", "Content")} *</Label>
                <Select value={contentId} onValueChange={setContentId}>
                  <SelectTrigger dir="rtl">
                    <SelectValue
                      placeholder={L("اختر من مكتبة المحتوى…", "Pick from library…")}
                    />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {contents.map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        <span className="flex items-center gap-2">
                          <ContentTypeIcon type={c.contentType} className="size-3.5" />
                          <span className="max-w-56 truncate">{c.title}</span>
                          {c.status === "published" && (
                            <Badge className="bg-green-100 text-green-700">
                              {L("منشور", "Published")}
                            </Badge>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {contentId && (
                <ConflictChecker
                  contentId={contentId}
                  allowRepublish={allowRepublish}
                  onAllowRepublishChange={setAllowRepublish}
                  L={L}
                />
              )}
            </div>
          )}

          {!isEdit && mode === "new" && (
            <div className="space-y-3 rounded-xl border p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{L("العنوان", "Title")} *</Label>
                  <Input
                    value={nc.title}
                    onChange={(e) => setNc({ ...nc, title: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Slug *</Label>
                  <Input
                    value={nc.slug}
                    onChange={(e) => setNc({ ...nc, slug: e.target.value })}
                    dir="ltr"
                    placeholder="my-audiobook"
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{L("الوصف", "Description")} *</Label>
                <Textarea
                  value={nc.description}
                  onChange={(e) => setNc({ ...nc, description: e.target.value })}
                  rows={2}
                  required
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{L("نوع المحتوى", "Content type")}</Label>
                  <Select
                    value={nc.contentType}
                    onValueChange={(v) => setNc({ ...nc, contentType: v })}
                  >
                    <SelectTrigger dir="rtl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TYPE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v.ar}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{L("رابط الغلاف", "Cover URL")}</Label>
                  <Input
                    value={nc.coverImage}
                    onChange={(e) => setNc({ ...nc, coverImage: e.target.value })}
                    dir="ltr"
                    placeholder="https://…"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{L("وسوم (مفصولة بفاصلة)", "Keywords (comma separated)")}</Label>
                <Input
                  value={nc.keywordsText}
                  onChange={(e) => setNc({ ...nc, keywordsText: e.target.value })}
                  placeholder="روايات، تاريخ"
                />
              </div>
              {categories && categories.length > 0 && (
                <div className="space-y-1.5">
                  <Label>{L("التصنيفات", "Categories")}</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map((cat) => {
                      const active = selectedCats.includes(cat._id);
                      return (
                        <button
                          key={cat._id}
                          type="button"
                          onClick={() =>
                            setSelectedCats(
                              active
                                ? selectedCats.filter((x) => x !== cat._id)
                                : [...selectedCats, cat._id],
                            )
                          }
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-xs font-bold transition-colors",
                            active ? "border-primary bg-primary text-white" : "hover:bg-muted",
                          )}
                        >
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Date / time / timezone */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>{L("تاريخ النشر", "Publish date")} *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label>{L("وقت النشر", "Publish time")} *</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label>{L("المنطقة الزمنية", "Timezone")}</Label>
              <Input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                dir="ltr"
                placeholder={DEFAULT_TIMEZONE}
                className={cn(!tzValid && "border-red-400")}
              />
            </div>
          </div>
          {!tzValid && (
            <p className="text-xs font-semibold text-red-600">
              {L(
                "منطقة زمنية غير صالحة — مثال: Africa/Cairo",
                "Invalid timezone — e.g. Africa/Cairo",
              )}
            </p>
          )}

          {/* Recurrence */}
          <div className="space-y-3 rounded-xl border bg-secondary/40 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{L("التكرار", "Recurrence")}</Label>
                <Select
                  value={freq}
                  onValueChange={(v) => setFreq(v as RecurrenceForm["freq"])}
                >
                  <SelectTrigger dir="rtl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{L("بدون تكرار", "No recurrence")}</SelectItem>
                    <SelectItem value="daily">{L("يوميًا", "Daily")}</SelectItem>
                    <SelectItem value="weekly">
                      {L("أسبوعيًا (أيام محددة)", "Weekly (specific days)")}
                    </SelectItem>
                    <SelectItem value="monthly">
                      {L("شهريًا (يوم من الشهر)", "Monthly (day of month)")}
                    </SelectItem>
                    <SelectItem value="interval_days">{L("كل عدة أيام", "Every N days")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {freq === "interval_days" && (
                <div className="space-y-1.5">
                  <Label>{L("عدد الأيام (2-30)", "Days interval (2-30)")}</Label>
                  <Input
                    type="number"
                    min={2}
                    max={30}
                    value={intervalDays}
                    onChange={(e) => setIntervalDays(Number(e.target.value) || 2)}
                    dir="ltr"
                  />
                </div>
              )}
              {freq === "monthly" && (
                <div className="space-y-1.5">
                  <Label>{L("يوم الشهر (1-28)", "Day of month (1-28)")}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={28}
                    value={monthDay}
                    onChange={(e) => setMonthDay(Number(e.target.value) || 1)}
                    dir="ltr"
                  />
                </div>
              )}
            </div>
            {freq === "weekly" && (
              <div className="space-y-1.5">
                <Label>{L("أيام الأسبوع", "Weekdays")}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAY_LABELS_AR.map((label, idx) => {
                    const active = weekdays.includes(idx);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() =>
                          setWeekdays(
                            active ? weekdays.filter((x) => x !== idx) : [...weekdays, idx],
                          )
                        }
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-bold transition-colors",
                          active ? "border-primary bg-primary text-white" : "hover:bg-muted",
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {freq !== "none" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{L("نهاية التكرار (اختياري)", "Series end (optional)")}</Label>
                  <Input
                    type="date"
                    value={endsAtDate}
                    onChange={(e) => setEndsAtDate(e.target.value)}
                    dir="ltr"
                  />
                </div>
                <div className="flex items-end text-xs text-muted-foreground">
                  {L(
                    `سيتكرر النشر في وقت ${time} حسب القاعدة أعلاه.`,
                    `Publishing will repeat at ${time} per the rule above.`,
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Status */}
          {!isEdit && (
            <div className="space-y-1.5">
              <Label>{L("حالة الجدولة", "Schedule status")}</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as "scheduled" | "draft")}
              >
                <SelectTrigger dir="rtl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">
                    {L("مجدول (سينشر تلقائيًا)", "Scheduled (auto-publish)")}
                  </SelectItem>
                  <SelectItem value="draft">{L("مسودة (لن يُنشر)", "Draft (won't publish)")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            {L("إلغاء", "Cancel")}
          </Button>
          {!isEdit && (
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => submit("draft")}
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {L("حفظ كمسودة", "Save as draft")}
            </Button>
          )}
          <Button
            type="button"
            className="bg-primary font-bold text-white hover:bg-primary/90"
            disabled={saving}
            onClick={() => submit(isEdit ? "scheduled" : status)}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CalendarClock className="size-4" />
            )}
            {isEdit ? L("حفظ التعديلات", "Save changes") : L("جدولة النشر", "Schedule publish")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- calendar nav + views ----------------

function CalendarNavRow({
  L,
  view,
  onViewChange,
  onShift,
  onToday,
  label,
}: {
  L: LFn;
  view: "month" | "week" | "day";
  onViewChange: (v: "month" | "week" | "day") => void;
  onShift: (dir: 1 | -1) => void;
  onToday: () => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="size-8" onClick={() => onShift(-1)} aria-label="prev">
          <ChevronRight className="size-4" />
        </Button>
        <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={onToday}>
          {L("اليوم", "Today")}
        </Button>
        <Button variant="outline" size="icon" className="size-8" onClick={() => onShift(1)} aria-label="next">
          <ChevronLeft className="size-4" />
        </Button>
      </div>
      <p className="text-sm font-black">{label}</p>
      <div className="flex gap-1">
        {(["month", "week", "day"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onViewChange(v)}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-bold transition-colors",
              view === v ? "bg-primary text-white" : "hover:bg-muted",
            )}
          >
            {v === "month" ? L("شهري", "Month") : v === "week" ? L("أسبوعي", "Week") : L("يومي", "Day")}
          </button>
        ))}
      </div>
    </div>
  );
}

const WEEK_HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 06:00–23:00

type CellProps = {
  schedules: ScheduleRow[];
  L: LFn;
  onDropCell: (scheduleId: string, date: string, time: string) => void;
  dragOverKey: string | null;
  setDragOverKey: (k: string | null) => void;
  onOpenEdit: (s: ScheduleRow) => void;
};

function MonthGrid({
  cursor,
  schedules,
  L,
  onDropCell,
  dragOverKey,
  setDragOverKey,
  onOpenEdit,
}: CellProps & { cursor: string }) {
  const [y, m] = cursor.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); // 0=Sun
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(ymdOf(y, m, d));

  const byDate = new Map<string, ScheduleRow[]>();
  for (const s of schedules) {
    const key = zonedDateStr(s.scheduledAt, s.timezone);
    const list = byDate.get(key) ?? [];
    list.push(s);
    byDate.set(key, list);
  }
  const todayStr = zonedDateStr(Date.now(), DEFAULT_TIMEZONE);

  return (
    <div className="mt-2">
      <div className="grid grid-cols-7 border-b bg-secondary/50 text-center text-[11px] font-bold text-muted-foreground">
        {WEEKDAY_LABELS_AR.map((w) => (
          <div key={w} className="p-2">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((date, i) => {
          const items = date ? byDate.get(date) ?? [] : [];
          const isToday = date === todayStr;
          const cellKey = `m-${date ?? i}`;
          return (
            <div
              key={cellKey}
              onDragOver={(e) => {
                if (!date) return;
                e.preventDefault();
                setDragOverKey(cellKey);
              }}
              onDragLeave={() => setDragOverKey(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverKey(null);
                const id = e.dataTransfer.getData("text/schedule-id");
                if (!id || !date) return;
                // Keep the item's own wall-clock time; change only the date.
                const s = schedules.find((x) => x._id === id);
                onDropCell(id, date, s ? zonedTimeStr(s.scheduledAt, s.timezone) : "09:00");
              }}
              className={cn(
                "min-h-24 space-y-1 border-b border-s p-1.5",
                !date && "bg-muted/40",
                dragOverKey === cellKey && "bg-primary/10 outline-2 outline-dashed outline-primary",
              )}
            >
              {date && (
                <p
                  className={cn(
                    "text-[11px] font-bold tabular-nums",
                    isToday
                      ? "inline-flex size-5 items-center justify-center rounded-full bg-primary text-white"
                      : "text-muted-foreground",
                  )}
                >
                  {Number(date.slice(8))}
                </p>
              )}
              {items.slice(0, 4).map((s) => (
                <ScheduleCard key={s._id} s={s} L={L} onOpenEdit={onOpenEdit} />
              ))}
              {items.length > 4 && (
                <p className="text-[10px] font-semibold text-primary">
                  +{items.length - 4} {L("أخرى", "more")}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({
  cursor,
  schedules,
  L,
  onDropCell,
  dragOverKey,
  setDragOverKey,
  onOpenEdit,
}: CellProps & { cursor: string }) {
  const [y, m, d] = cursor.split("-").map(Number);
  const startOffset = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const startDate = new Date(Date.UTC(y, m - 1, d - startOffset));
  const weekDays: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(startDate);
    dt.setUTCDate(startDate.getUTCDate() + i);
    weekDays.push(ymdOf(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()));
  }
  const byKey = new Map<string, ScheduleRow[]>();
  for (const s of schedules) {
    const key = `${zonedDateStr(s.scheduledAt, s.timezone)}|${zonedTimeStr(s.scheduledAt, s.timezone).slice(0, 2)}`;
    const list = byKey.get(key) ?? [];
    list.push(s);
    byKey.set(key, list);
  }
  const todayStr = zonedDateStr(Date.now(), DEFAULT_TIMEZONE);

  return (
    <div className="mt-2 overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b bg-secondary/50 text-center text-[11px] font-bold text-muted-foreground">
          <div />
          {weekDays.map((date) => (
            <div
              key={date}
              className={cn("p-2", date === todayStr && "bg-primary/10 text-primary")}
            >
              {WEEKDAY_LABELS_AR[new Date(date + "T00:00:00Z").getUTCDay()]}
              <span className="ms-1 tabular-nums">{Number(date.slice(8))}</span>
            </div>
          ))}
        </div>
        {WEEK_HOURS.map((hh) => (
          <div key={hh} className="grid grid-cols-[56px_repeat(7,1fr)] border-b">
            <div
              className="border-e p-1 text-center text-[10px] font-bold tabular-nums text-muted-foreground"
              dir="ltr"
            >
              {String(hh).padStart(2, "0")}:00
            </div>
            {weekDays.map((date) => {
              const key = `${date}|${String(hh).padStart(2, "0")}`;
              const items = byKey.get(key) ?? [];
              return (
                <div
                  key={key}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverKey(key);
                  }}
                  onDragLeave={() => setDragOverKey(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverKey(null);
                    const id = e.dataTransfer.getData("text/schedule-id");
                    if (id) onDropCell(id, date, `${String(hh).padStart(2, "0")}:00`);
                  }}
                  className={cn(
                    "min-h-10 space-y-1 border-e p-1",
                    dragOverKey === key && "bg-primary/10 outline-2 outline-dashed outline-primary",
                  )}
                >
                  {items.map((s) => (
                    <ScheduleCard key={s._id} s={s} L={L} onOpenEdit={onOpenEdit} />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function DayGrid({
  cursor,
  schedules,
  L,
  onDropCell,
  dragOverKey,
  setDragOverKey,
  onOpenEdit,
}: CellProps & { cursor: string }) {
  const byHour = new Map<string, ScheduleRow[]>();
  for (const s of schedules) {
    if (zonedDateStr(s.scheduledAt, s.timezone) !== cursor) continue;
    const hh = zonedTimeStr(s.scheduledAt, s.timezone).slice(0, 2);
    const list = byHour.get(hh) ?? [];
    list.push(s);
    byHour.set(hh, list);
  }
  return (
    <div className="mt-2">
      {Array.from({ length: 24 }, (_, hh) => String(hh).padStart(2, "0")).map((hh) => {
        const items = byHour.get(hh) ?? [];
        const key = `${cursor}|${hh}`;
        return (
          <div key={hh} className="grid grid-cols-[56px_1fr] border-b">
            <div
              className="border-e p-2 text-center text-xs font-bold tabular-nums text-muted-foreground"
              dir="ltr"
            >
              {hh}:00
            </div>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverKey(key);
              }}
              onDragLeave={() => setDragOverKey(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverKey(null);
                const id = e.dataTransfer.getData("text/schedule-id");
                if (id) onDropCell(id, cursor, `${hh}:00`);
              }}
              className={cn(
                "min-h-10 space-y-1.5 p-1.5",
                dragOverKey === key && "bg-primary/10 outline-2 outline-dashed outline-primary",
              )}
            >
              {items.map((s) => (
                <ScheduleCard key={s._id} s={s} L={L} onOpenEdit={onOpenEdit} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------- events log ----------------

function EventsLog({ L }: { L: LFn }) {
  const events = useQuery(api.scheduler.listEvents, { limit: 150 });
  if (events === undefined) {
    return <Skeleton className="h-64 rounded-2xl" />;
  }
  if (events.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {L("لا يوجد نشاط بعد", "No activity yet")}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {(events as ScheduleEventRow[]).map((e) => {
        const meta = actionMeta(e.action);
        const Icon = meta.icon;
        return (
          <div key={e._id} className="flex items-start gap-3 rounded-xl border bg-card p-3">
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg",
                e.success ? "bg-primary/10 text-primary" : "bg-red-100 text-red-600",
              )}
            >
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 text-sm font-bold">
                {meta.label}
                <span className="font-normal text-muted-foreground">
                  {e.contentTitle ?? "—"}
                </span>
              </p>
              {e.detail && <p className="mt-0.5 text-xs text-muted-foreground">{e.detail}</p>}
              {e.error && (
                <p className="mt-0.5 text-xs font-semibold text-red-600">{e.error}</p>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground" dir="ltr">
                {e.actorName ? `${e.actorName} · ` : ""}
                {new Date(e.createdAt).toISOString().replace("T", " ").slice(0, 16)} UTC
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------- notifications ----------------

function NotificationsPanel({ L }: { L: LFn }) {
  const notifications = useQuery(api.scheduler.myNotifications, {});
  const markRead = useMutation(api.scheduler.markMyNotificationsRead);
  const [busy, setBusy] = useState(false);
  const unread = (notifications ?? []).filter((n) => !n.isRead).length;

  const markAll = async () => {
    setBusy(true);
    try {
      const res = await markRead({});
      toast.success(L(`تم تعليم ${res.patched} كمقروء`, `Marked ${res.patched} as read`));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (notifications === undefined) {
    return <Skeleton className="h-64 rounded-2xl" />;
  }
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold">
          {L("تنبيهات الجدولة", "Scheduling notifications")}
          {unread > 0 && <Badge className="ms-2 bg-primary text-white">{unread}</Badge>}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          disabled={busy || unread === 0}
          onClick={markAll}
        >
          <CheckCheck className="size-3.5" />
          {L("تعليم الكل كمقروء", "Mark all read")}
        </Button>
      </div>
      {notifications.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {L("لا توجد تنبيهات بعد", "No notifications yet")}
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {notifications.map((n) => (
            <div
              key={n._id}
              className={cn(
                "rounded-xl border p-3",
                n.isRead ? "bg-card opacity-70" : "border-primary/40 bg-primary/5",
              )}
            >
              <p className="flex items-start gap-2 text-sm font-bold">
                {!n.isRead && <Bell className="mt-0.5 size-4 shrink-0 text-primary" />}
                {n.title}
              </p>
              <p className="mt-0.5 ps-6 text-xs text-muted-foreground">{n.body}</p>
              <p className="mt-1 ps-6 text-[11px] text-muted-foreground" dir="ltr">
                {new Date(n.createdAt).toISOString().replace("T", " ").slice(0, 16)} UTC
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------- main ----------------

export function ContentSchedulerManager({ L }: { L: LFn }) {
  const schedules = useQuery(api.scheduler.listSchedules, {});
  const stats = useQuery(api.scheduler.getStats, {});
  const categories = useQuery(api.content.listCategories, {});
  const allContent = useQuery(api.content.listAllForAdmin, {});

  const reschedule = useMutation(api.scheduler.reschedule);
  const setScheduleStatus = useMutation(api.scheduler.setScheduleStatus);
  const deleteSchedule = useMutation(api.scheduler.deleteSchedule);
  const publishNow = useMutation(api.scheduler.publishNow);
  const retrySchedule = useMutation(api.scheduler.retrySchedule);
  const duplicateSchedule = useMutation(api.scheduler.duplicateSchedule);
  const bulkAction = useMutation(api.scheduler.bulkAction);

  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [cursor, setCursor] = useState(() => zonedDateStr(Date.now(), DEFAULT_TIMEZONE));
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [quickFilter, setQuickFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<ScheduleRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleRow | null>(null);
  const [bulkDate, setBulkDate] = useState("");
  const [bulkTime, setBulkTime] = useState("");

  const rows: ScheduleRow[] = useMemo(() => (schedules ?? []) as ScheduleRow[], [schedules]);

  const nowMs = Date.now();
  const todayStr = zonedDateStr(nowMs, DEFAULT_TIMEZONE);
  const tomorrowStr = zonedDateStr(nowMs + 86_400_000, DEFAULT_TIMEZONE);
  const dayStart = zonedToUtc(todayStr, "00:00", DEFAULT_TIMEZONE);
  const weekEnd = dayStart + 7 * 86_400_000;
  const monthStart = (() => {
    const [y, m] = todayStr.split("-").map(Number);
    return zonedToUtc(ymdOf(y, m, 1), "00:00", DEFAULT_TIMEZONE);
  })();
  const monthEnd = (() => {
    const [y, m] = todayStr.split("-").map(Number);
    const ny = m === 12 ? y + 1 : y;
    const nm = m === 12 ? 1 : m + 1;
    return zonedToUtc(ymdOf(ny, nm, 1), "00:00", DEFAULT_TIMEZONE);
  })();

  const quickFiltered = rows.filter((s) => {
    const d = zonedDateStr(s.scheduledAt, s.timezone);
    switch (quickFilter) {
      case "today":
        return d === todayStr;
      case "tomorrow":
        return d === tomorrowStr;
      case "week":
        return s.scheduledAt >= dayStart && s.scheduledAt < weekEnd;
      case "month":
        return s.scheduledAt >= monthStart && s.scheduledAt < monthEnd;
      case "scheduled":
        return s.status === "scheduled";
      case "published":
        return s.status === "published";
      case "failed":
        return s.status === "failed";
      case "cancelled":
        return s.status === "cancelled";
      default:
        return true;
    }
  });

  const visible = quickFiltered
    .filter((s) => (typeFilter === "all" ? true : s.content?.contentType === typeFilter))
    .filter((s) => (statusFilter === "all" ? true : s.status === statusFilter))
    .filter((s) =>
      search.trim()
        ? (s.content?.title ?? "").toLowerCase().includes(search.trim().toLowerCase())
        : true,
    );

  const contents = (allContent ?? []).map((c) => ({
    _id: c._id as string,
    title: c.title,
    contentType: c.contentType,
    status: c.status,
  }));

  const calendarSchedules = quickFiltered.filter((s) => s.status !== "cancelled");

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const runBulk = async (
    action: "cancel" | "delete" | "publishNow" | "reschedule" | "setStatus",
    extra?: { status?: "draft" | "scheduled" | "cancelled" },
  ) => {
    if (selected.size === 0) return;
    try {
      const res = await bulkAction({
        ids: Array.from(selected) as Id<"content_schedules">[],
        action,
        date: action === "reschedule" ? bulkDate || undefined : undefined,
        time: action === "reschedule" ? bulkTime || undefined : undefined,
        timezone: action === "reschedule" ? DEFAULT_TIMEZONE : undefined,
        status: extra?.status,
      });
      if (res.failed.length === 0) {
        toast.success(L(`تم التنفيذ على ${res.ok} جدولة`, `Applied to ${res.ok} schedules`));
      } else {
        toast.warning(
          L(
            `نجح ${res.ok}، فشل ${res.failed.length}: ${res.failed[0].error}`,
            `${res.ok} ok, ${res.failed.length} failed: ${res.failed[0].error}`,
          ),
        );
      }
      setSelected(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDropReschedule = async (id: string, date: string, time: string) => {
    try {
      await reschedule({ id: id as Id<"content_schedules">, date, time });
      toast.success(L(`تم تغيير الموعد إلى ${date} ${time}`, `Moved to ${date} ${time}`));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const act = async (fn: () => Promise<unknown>, okMsg: string) => {
    try {
      await fn();
      toast.success(okMsg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const canAct = (s: ScheduleRow) => s.status !== "publishing" && s.status !== "published";

  const shiftCursor = (dir: 1 | -1) => {
    const [y, m, d] = cursor.split("-").map(Number);
    const base = new Date(Date.UTC(y, m - 1, d));
    if (view === "month") {
      base.setUTCMonth(base.getUTCMonth() + dir, 1);
    } else {
      base.setUTCDate(base.getUTCDate() + dir * (view === "week" ? 7 : 1));
    }
    setCursor(ymdOf(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate()));
  };

  const calendarLabel = (() => {
    if (view === "month") {
      const [y, m] = cursor.split("-").map(Number);
      return L(`${MONTHS_AR[m - 1]} ${y}`, `${m}/${y}`);
    }
    if (view === "week") {
      const [y, m, d] = cursor.split("-").map(Number);
      const startOffset = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      const base = new Date(Date.UTC(y, m - 1, d - startOffset));
      const end = new Date(base);
      end.setUTCDate(base.getUTCDate() + 6);
      const fmt = (dt: Date) => `${dt.getUTCDate()}/${dt.getUTCMonth() + 1}`;
      return L(`الأسبوع ${fmt(base)} — ${fmt(end)}`, `Week ${fmt(base)} — ${fmt(end)}`);
    }
    return cursor;
  })();

  const statCards = [
    { label: L("مجدولة", "Scheduled"), value: stats?.totalScheduled, icon: CalendarClock, accent: "text-blue-600" },
    { label: L("مستحقة اليوم", "Due today"), value: stats?.dueToday, icon: Clock, accent: "text-primary" },
    { label: L("هذا الأسبوع", "This week"), value: stats?.dueThisWeek, icon: CalendarDays, accent: "text-violet-600" },
    { label: L("نُشرت", "Published"), value: stats?.succeeded, icon: CheckCircle2, accent: "text-green-600" },
    { label: L("فشلت", "Failed"), value: stats?.failed, icon: XCircle, accent: "text-red-600" },
    { label: L("تحتاج انتباه", "Needs attention"), value: stats?.needsAttention, icon: AlertTriangle, accent: "text-amber-600" },
  ];

  const openEdit = (s: ScheduleRow) => {
    setEditing(s);
    setDialogOpen(true);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black">
            <CalendarClock className="size-6 text-primary" />
            {L("جدولة المحتوى", "Content scheduling")}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {L(
              "جدولة النشر التلقائي مع التكرار والتقويم والتنبيهات.",
              "Automatic publishing with recurrence, calendar & alerts.",
            )}
            {stats?.timezone && (
              <span dir="ltr" className="ms-2 font-semibold">
                ({stats.timezone})
              </span>
            )}
          </p>
        </div>
        <Button
          className="bg-primary font-bold text-white hover:bg-primary/90"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" />
          {L("جدولة جديدة", "New schedule")}
        </Button>
      </div>

      {/* Mini dashboard */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {statCards.map((c) => (
          <div key={c.label} className="rounded-2xl border bg-card p-4 text-center card-shadow">
            <c.icon className={cn("mx-auto size-5", c.accent)} />
            <p className="mt-1.5 text-2xl font-black tabular-nums">
              {c.value === undefined ? "…" : c.value}
            </p>
            <p className="text-[11px] font-semibold text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="list" className="mt-6">
        <TabsList className="h-10 w-full max-w-md justify-start overflow-x-auto bg-muted/60">
          <TabsTrigger value="list" className="gap-1.5">
            <CalendarClock className="size-4" />
            {L("القائمة", "List")}
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1.5">
            <CalendarDays className="size-4" />
            {L("التقويم", "Calendar")}
          </TabsTrigger>
          <TabsTrigger value="events" className="gap-1.5">
            <History className="size-4" />
            {L("السجل", "Activity")}
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5">
            <Bell className="size-4" />
            {L("التنبيهات", "Alerts")}
          </TabsTrigger>
        </TabsList>

        {/* ---------- LIST ---------- */}
        <TabsContent value="list">
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-52 flex-1">
              <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={L("ابحث بعنوان المحتوى…", "Search by content title…")}
                className="ps-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-36" dir="rtl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{L("كل الأنواع", "All types")}</SelectItem>
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v.ar}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36" dir="rtl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{L("كل الحالات", "All statuses")}</SelectItem>
                {["draft", "scheduled", "publishing", "published", "failed", "cancelled"].map((s) => (
                  <SelectItem key={s} value={s}>
                    {scheduleStatusAr(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quick filters */}
          <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto pb-1">
            {[
              { k: "all", label: L("الكل", "All") },
              { k: "today", label: L("اليوم", "Today") },
              { k: "tomorrow", label: L("غدًا", "Tomorrow") },
              { k: "week", label: L("هذا الأسبوع", "This week") },
              { k: "month", label: L("هذا الشهر", "This month") },
              { k: "scheduled", label: L("مجدول", "Scheduled") },
              { k: "published", label: L("منشور", "Published") },
              { k: "failed", label: L("فاشل", "Failed") },
              { k: "cancelled", label: L("ملغي", "Cancelled") },
            ].map((q) => (
              <button
                key={q.k}
                type="button"
                onClick={() => setQuickFilter(q.k)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                  quickFilter === q.k ? "border-primary bg-primary text-white" : "hover:bg-muted",
                )}
              >
                {q.label}
              </button>
            ))}
          </div>

          {/* Bulk bar */}
          {selected.size > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 p-3">
              <span className="text-sm font-bold text-primary">
                {L(`محدد: ${selected.size}`, `${selected.size} selected`)}
              </span>
              <Button
                size="sm"
                className="h-8 gap-1 bg-primary text-white hover:bg-primary/90"
                onClick={() => runBulk("publishNow")}
              >
                <Zap className="size-3.5" />
                {L("نشر الآن", "Publish now")}
              </Button>
              <Button size="sm" variant="outline" className="h-8" onClick={() => runBulk("cancel")}>
                <X className="size-3.5" />
                {L("إلغاء الجدولة", "Cancel")}
              </Button>
              <div className="flex items-center gap-1">
                <Input
                  type="date"
                  value={bulkDate}
                  onChange={(e) => setBulkDate(e.target.value)}
                  className="h-8 w-36 text-xs"
                  dir="ltr"
                />
                <Input
                  type="time"
                  value={bulkTime}
                  onChange={(e) => setBulkTime(e.target.value)}
                  className="h-8 w-28 text-xs"
                  dir="ltr"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  disabled={!bulkDate || !bulkTime}
                  onClick={() => runBulk("reschedule")}
                >
                  <Clock className="size-3.5" />
                  {L("تغيير الموعد", "Move")}
                </Button>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => runBulk("setStatus", { status: "draft" })}
              >
                <FileText className="size-3.5" />
                {L("تحويل لمسودة", "To draft")}
              </Button>
              <Button size="sm" variant="destructive" className="h-8" onClick={() => runBulk("delete")}>
                <Trash2 className="size-3.5" />
                {L("حذف", "Delete")}
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setSelected(new Set())}>
                {L("مسح التحديد", "Clear")}
              </Button>
            </div>
          )}

          {/* Table */}
          {schedules === undefined ? (
            <Skeleton className="mt-4 h-72 rounded-2xl" />
          ) : visible.length === 0 ? (
            <div className="mt-4 rounded-2xl border bg-card p-10 text-center">
              <CalendarClock className="mx-auto size-8 text-muted-foreground/50" />
              <p className="mt-3 font-bold">{L("لا توجد جدولات", "No schedules")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {L(
                  "أنشئ أول جدولة بزر «جدولة جديدة» — سينشر المحتوى تلقائيًا في موعده.",
                  "Create your first schedule — content publishes automatically on time.",
                )}
              </p>
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-2xl border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] text-sm">
                  <thead>
                    <tr className="border-b bg-secondary/60 text-start text-xs text-muted-foreground">
                      <th className="w-10 p-3">
                        <input
                          type="checkbox"
                          checked={visible.length > 0 && visible.every((s) => selected.has(s._id))}
                          onChange={(e) =>
                            setSelected(
                              e.target.checked ? new Set(visible.map((s) => s._id)) : new Set(),
                            )
                          }
                          aria-label={L("تحديد الكل", "Select all")}
                        />
                      </th>
                      <th className="p-3 text-start font-semibold">{L("المحتوى", "Content")}</th>
                      <th className="p-3 text-start font-semibold">{L("موعد النشر", "Publish time")}</th>
                      <th className="p-3 text-start font-semibold">{L("الحالة", "Status")}</th>
                      <th className="p-3 text-start font-semibold">{L("بواسطة", "By")}</th>
                      <th className="p-3 text-start font-semibold">{L("إجراءات", "Actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((s) => (
                      <tr key={s._id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selected.has(s._id)}
                            onChange={() => toggleSelect(s._id)}
                            aria-label={L("تحديد", "Select")}
                          />
                        </td>
                        <td className="max-w-[260px] p-3">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={s.content?.coverImage || LOGO_COVER}
                              alt=""
                              loading="lazy"
                              className="size-9 shrink-0 rounded-md object-cover"
                            />
                            <div className="min-w-0">
                              <p className="truncate font-bold">
                                {s.content?.title ?? "—"}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {
                                  TYPE_LABELS[
                                    s.content?.contentType as keyof typeof TYPE_LABELS
                                  ]?.ar ?? s.content?.contentType
                                }
                                {s.recurrence && s.recurrence.freq !== "none" && (
                                  <span className="ms-1 text-primary">
                                    · {recLabel(s.recurrence as RecurrenceForm, L)}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <p className="font-semibold tabular-nums" dir="ltr">
                            {zonedDateStr(s.scheduledAt, s.timezone)}{" "}
                            {zonedTimeStr(s.scheduledAt, s.timezone)}
                          </p>
                          <p className="text-[11px] text-muted-foreground" dir="ltr">
                            {s.timezone}
                          </p>
                        </td>
                        <td className="p-3">
                          <Badge className={statusBadgeClass(s.status)}>
                            {scheduleStatusAr(s.status)}
                          </Badge>
                          {s.status === "failed" && s.lastError && (
                            <p
                              className="mt-1 max-w-40 truncate text-[11px] font-semibold text-red-600"
                              title={s.lastError}
                            >
                              {s.lastError}
                            </p>
                          )}
                          {s.status === "published" && s.publishedAt && (
                            <p className="mt-1 text-[11px] text-muted-foreground" dir="ltr">
                              {zonedDateStr(s.publishedAt, s.timezone)}
                            </p>
                          )}
                        </td>
                        <td className="p-3">
                          <p className="text-xs font-semibold">{s.createdByName ?? "—"}</p>
                          <p className="text-[11px] text-muted-foreground" dir="ltr">
                            {new Date(s.createdAt).toISOString().slice(0, 10)}
                          </p>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {s.status !== "publishing" && s.status !== "published" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                title={L("نشر الآن", "Publish now")}
                                onClick={() =>
                                  act(
                                    () => publishNow({ id: s._id }),
                                    L("بدأ النشر الآن", "Publishing started"),
                                  )
                                }
                              >
                                <Zap className="size-3.5 text-primary" />
                              </Button>
                            )}
                            {s.status === "failed" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                title={L("إعادة المحاولة", "Retry")}
                                onClick={() =>
                                  act(
                                    () => retrySchedule({ id: s._id }),
                                    L("أُعيدت الجدولة للمحاولة مجددًا", "Retry scheduled"),
                                  )
                                }
                              >
                                <RotateCcw className="size-3.5 text-blue-600" />
                              </Button>
                            )}
                            {s.content && (
                              <Link to={`/content/${s.content.slug}`} target="_blank">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7"
                                  title={L("معاينة", "Preview")}
                                >
                                  <Eye className="size-3.5" />
                                </Button>
                              </Link>
                            )}
                            {canAct(s) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                title={L("تعديل", "Edit")}
                                onClick={() => openEdit(s)}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                            )}
                            {canAct(s) && s.status !== "draft" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                title={L("تحويل إلى مسودة", "Convert to draft")}
                                onClick={() =>
                                  act(
                                    () => setScheduleStatus({ id: s._id, status: "draft" }),
                                    L("أُحوّلت إلى مسودة", "Converted to draft"),
                                  )
                                }
                              >
                                <FileText className="size-3.5 text-amber-600" />
                              </Button>
                            )}
                            {canAct(s) && s.status !== "cancelled" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                title={L("إلغاء الجدولة", "Cancel schedule")}
                                onClick={() =>
                                  act(
                                    () => setScheduleStatus({ id: s._id, status: "cancelled" }),
                                    L("أُلغيت الجدولة", "Schedule cancelled"),
                                  )
                                }
                              >
                                <X className="size-3.5 text-gray-500" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              title={L("نسخ كمسودة", "Duplicate as draft")}
                              onClick={() =>
                                act(
                                  () => duplicateSchedule({ id: s._id }),
                                  L("نُسخت كمسودة جديدة", "Duplicated as draft"),
                                )
                              }
                            >
                              <Copy className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              title={L("حذف", "Delete")}
                              onClick={() => setPendingDelete(s)}
                            >
                              <Trash2 className="size-3.5 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ---------- CALENDAR ---------- */}
        <TabsContent value="calendar">
          <div className="mt-4 rounded-2xl border bg-card p-3 card-shadow">
            <CalendarNavRow
              L={L}
              view={view}
              onViewChange={setView}
              onShift={shiftCursor}
              onToday={() => setCursor(zonedDateStr(Date.now(), DEFAULT_TIMEZONE))}
              label={calendarLabel}
            />
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              {L(
                "اسحب بطاقة الجدولة إلى يوم أو ساعة أخرى لتغيير موعدها.",
                "Drag a schedule card onto another day or hour to reschedule it.",
              )}
            </p>
            {view === "month" && (
              <MonthGrid
                cursor={cursor}
                schedules={calendarSchedules}
                L={L}
                onDropCell={handleDropReschedule}
                dragOverKey={dragOverKey}
                setDragOverKey={setDragOverKey}
                onOpenEdit={openEdit}
              />
            )}
            {view === "week" && (
              <WeekGrid
                cursor={cursor}
                schedules={calendarSchedules}
                L={L}
                onDropCell={handleDropReschedule}
                dragOverKey={dragOverKey}
                setDragOverKey={setDragOverKey}
                onOpenEdit={openEdit}
              />
            )}
            {view === "day" && (
              <DayGrid
                cursor={cursor}
                schedules={calendarSchedules}
                L={L}
                onDropCell={handleDropReschedule}
                dragOverKey={dragOverKey}
                setDragOverKey={setDragOverKey}
                onOpenEdit={openEdit}
              />
            )}
          </div>
        </TabsContent>

        {/* ---------- EVENTS ---------- */}
        <TabsContent value="events">
          <div className="mt-4">
            <EventsLog L={L} />
          </div>
        </TabsContent>

        {/* ---------- NOTIFICATIONS ---------- */}
        <TabsContent value="notifications">
          <div className="mt-4">
            <NotificationsPanel L={L} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Create / edit dialog */}
      {dialogOpen && (
        <ScheduleDialog
          key={editing?._id ?? "new"}
          L={L}
          editing={editing}
          categories={categories}
          contents={contents}
          onClose={() => {
            setDialogOpen(false);
            setEditing(null);
          }}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{L("حذف الجدولة؟", "Delete this schedule?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {L(
                `سيتم حذف جدولة «${pendingDelete?.content?.title ?? ""}» وسجل نشاطها نهائيًا. لن يتأثر المحتوى نفسه.`,
                `Schedule for "${pendingDelete?.content?.title ?? ""}" and its event trail will be permanently deleted. The content itself is not affected.`,
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{L("تراجع", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                if (!pendingDelete) return;
                const target = pendingDelete;
                setPendingDelete(null);
                await act(
                  () => deleteSchedule({ id: target._id }),
                  L("حُذفت الجدولة", "Schedule deleted"),
                );
              }}
            >
              {L("حذف نهائي", "Delete permanently")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
