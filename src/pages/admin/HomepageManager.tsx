import { api } from "@/convex/_generated/api";
import { TYPE_LABELS } from "@/components/ContentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  ListPlus,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const SOURCE_LABELS: Record<string, { ar: string; en: string }> = {
  trending: { ar: "الأكثر استماعًا (تلقائي)", en: "Most listened (auto)" },
  new: { ar: "الأحدث إضافة (تلقائي)", en: "Newest (auto)" },
  featured: { ar: "المحتوى المميز (تلقائي)", en: "Featured (auto)" },
  type: { ar: "حسب النوع", en: "By content type" },
  manual: { ar: "اختيار يدوي", en: "Manual picks" },
};

/**
 * Full CRUD over homepage_sections: rename, reorder, hide, switch data source,
 * and (for manual sections) pick the exact titles that appear.
 */
export function HomepageManager({ L }: { L: (ar: string, en: string) => string }) {
  const { lang } = useLang();
  const sections = useQuery(api.homepage.listSections, {});
  const allContent = useQuery(api.content.listAllForAdmin, {});
  const patchSection = useMutation(api.homepage.patchSection);
  const upsertSection = useMutation(api.homepage.upsertSection);
  const deleteSection = useMutation(api.homepage.deleteSection);
  const setSectionItems = useMutation(api.homepage.setSectionItems);

  const [creating, setCreating] = useState(false);
  const [newSection, setNewSection] = useState({
    titleAr: "",
    titleEn: "",
    sourceType: "trending",
    contentType: "",
    limit: 12,
  });
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);

  const sorted = [...(sections ?? [])].sort((a, b) => a.order - b.order);

  const move = async (section: any, dir: -1 | 1) => {
    const idx = sorted.findIndex((s) => s._id === section._id);
    const swapWith = sorted[idx + dir];
    if (!swapWith) return;
    await patchSection({ id: section._id, order: swapWith.order });
    await patchSection({ id: swapWith._id, order: section.order });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">{L("أقسام الصفحة الرئيسية", "Homepage sections")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {L(
              "أدر أقسام الصفحة الرئيسية بالكامل: الاسم، الترتيب، الإظهار، ومصدر البيانات — كل شيء من قاعدة البيانات.",
              "Fully manage the homepage: names, order, visibility, and data sources — all from the database.",
            )}
          </p>
        </div>
        <Button onClick={() => setCreating((v) => !v)} className="font-bold">
          <Plus className="size-4" />
          {L("قسم جديد", "New section")}
        </Button>
      </div>

      {/* New section form */}
      {creating && (
        <div className="mt-4 rounded-2xl border bg-secondary/40 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1">
              <Label>{L("العنوان (عربي)", "Title (Arabic)")}</Label>
              <Input
                value={newSection.titleAr}
                onChange={(e) => setNewSection({ ...newSection, titleAr: e.target.value })}
                placeholder={L("مثال: مقترحة لك", "e.g. Suggested")}
              />
            </div>
            <div className="space-y-1">
              <Label>{L("العنوان (إنجليزي)", "Title (English)")}</Label>
              <Input
                value={newSection.titleEn}
                onChange={(e) => setNewSection({ ...newSection, titleEn: e.target.value })}
                placeholder="e.g. Suggested for you"
                dir="ltr"
              />
            </div>
            <div className="space-y-1">
              <Label>{L("مصدر البيانات", "Data source")}</Label>
              <select
                value={newSection.sourceType}
                onChange={(e) => setNewSection({ ...newSection, sourceType: e.target.value })}
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
              >
                {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {L(v.ar, v.en)}
                  </option>
                ))}
              </select>
            </div>
            {newSection.sourceType === "type" && (
              <div className="space-y-1">
                <Label>{L("النوع", "Content type")}</Label>
                <select
                  value={newSection.contentType}
                  onChange={(e) => setNewSection({ ...newSection, contentType: e.target.value })}
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                >
                  <option value="">—</option>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v[lang as "ar" | "en"]}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1">
              <Label>{L("عدد العناصر", "Items limit")}</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={newSection.limit}
                onChange={(e) => setNewSection({ ...newSection, limit: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreating(false)}>
              {L("إلغاء", "Cancel")}
            </Button>
            <Button
              disabled={!newSection.titleAr.trim() || !newSection.titleEn.trim()}
              onClick={async () => {
                try {
                  const order = (sections?.length ?? 0) + 1;
                  await upsertSection({
                    key: `custom-${Date.now()}`,
                    titleAr: newSection.titleAr.trim(),
                    titleEn: newSection.titleEn.trim(),
                    sourceType: newSection.sourceType,
                    contentType: newSection.sourceType === "type" ? newSection.contentType : undefined,
                    limit: newSection.limit,
                    isHidden: false,
                    order,
                  });
                  toast.success(L("أُضيف القسم — سيظهر في الصفحة الرئيسية", "Section added — it now appears on the homepage"));
                  setCreating(false);
                  setNewSection({ titleAr: "", titleEn: "", sourceType: "trending", contentType: "", limit: 12 });
                } catch (e: any) {
                  toast.error(e.message);
                }
              }}
            >
              <Save className="size-4" />
              {L("إضافة", "Add")}
            </Button>
          </div>
        </div>
      )}

      {/* Section list */}
      {sections === undefined ? (
        <Skeleton className="mt-6 h-64 rounded-2xl" />
      ) : (
        <div className="mt-6 space-y-3">
          {sorted.map((s: any, idx: number) => (
            <div key={s._id} className="rounded-2xl border bg-card p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-col gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-7"
                    disabled={idx === 0}
                    onClick={() => move(s, -1)}
                    aria-label={L("أعلى", "Move up")}
                  >
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-7"
                    disabled={idx === sorted.length - 1}
                    onClick={() => move(s, 1)}
                    aria-label={L("أسفل", "Move down")}
                  >
                    <ArrowDown className="size-3.5" />
                  </Button>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-extrabold">
                    {lang === "ar" ? s.titleAr : s.titleEn}
                    {s.isHidden && (
                      <span className="ms-2 text-xs font-semibold text-muted-foreground">
                        ({L("مخفي", "hidden")})
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {SOURCE_LABELS[s.sourceType]
                      ? L(SOURCE_LABELS[s.sourceType].ar, SOURCE_LABELS[s.sourceType].en)
                      : s.sourceType}
                    {s.sourceType === "type" && s.contentType
                      ? ` · ${TYPE_LABELS[s.contentType as keyof typeof TYPE_LABELS]?.[lang as "ar" | "en"] ?? s.contentType}`
                      : ""}
                    {` · ${L("حتى", "up to")} ${s.limit ?? 10} ${L("عنصرًا", "items")}`}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={s.isHidden ? L("إظهار", "Show") : L("إخفاء", "Hide")}
                    title={s.isHidden ? L("إظهار القسم", "Show section") : L("إخفاء القسم", "Hide section")}
                    onClick={async () => {
                      await patchSection({ id: s._id, isHidden: !s.isHidden });
                    }}
                  >
                    {s.isHidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>

                  {s.sourceType === "manual" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 text-xs"
                      onClick={() => setPicking(picking === s._id ? null : s._id)}
                    >
                      <ListPlus className="size-3.5" />
                      {L("اختيار الأعمال", "Pick items")}
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive"
                    aria-label={L("حذف القسم", "Delete section")}
                    onClick={async () => {
                      if (!confirm(L("حذف هذا القسم من الصفحة الرئيسية؟", "Delete this homepage section?"))) return;
                      await deleteSection({ id: s._id });
                      toast.success(L("تم الحذف", "Deleted"));
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              {/* Inline edit: titles + source + limit */}
              {editingKey === s._id ? (
                <SectionEditor
                  section={s}
                  L={L}
                  onDone={() => setEditingKey(null)}
                  upsert={upsertSection}
                />
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-7 text-xs text-muted-foreground"
                  onClick={() => setEditingKey(s._id)}
                >
                  {L("تعديل العنوان والمصدر", "Edit title & source")}
                </Button>
              )}

              {/* Manual item picker */}
              {picking === s._id && (
                <ManualPicker
                  sectionId={s._id}
                  current={s.itemIds ?? []}
                  items={allContent ?? []}
                  L={L}
                  onDone={() => setPicking(null)}
                  save={setSectionItems}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Inline editor for a section's title/source/limit. */
function SectionEditor({
  section,
  L,
  onDone,
  upsert,
}: {
  section: any;
  L: (ar: string, en: string) => string;
  onDone: () => void;
  upsert: ReturnType<typeof useMutation<any>>;
}) {
  const { lang } = useLang();
  const [state, setState] = useState({
    titleAr: section.titleAr,
    titleEn: section.titleEn,
    sourceType: section.sourceType,
    contentType: section.contentType ?? "",
    limit: section.limit ?? 10,
    order: section.order,
  });
  const [busy, setBusy] = useState(false);

  return (
    <div className="mt-3 rounded-xl border bg-secondary/40 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <Label>{L("العنوان (عربي)", "Title (Arabic)")}</Label>
          <Input value={state.titleAr} onChange={(e) => setState({ ...state, titleAr: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>{L("العنوان (إنجليزي)", "Title (English)")}</Label>
          <Input value={state.titleEn} dir="ltr" onChange={(e) => setState({ ...state, titleEn: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>{L("مصدر البيانات", "Data source")}</Label>
          <select
            value={state.sourceType}
            onChange={(e) => setState({ ...state, sourceType: e.target.value })}
            className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
          >
            {Object.entries(SOURCE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {L(v.ar, v.en)}
              </option>
            ))}
          </select>
        </div>
        {state.sourceType === "type" && (
          <div className="space-y-1">
            <Label>{L("النوع", "Content type")}</Label>
            <select
              value={state.contentType}
              onChange={(e) => setState({ ...state, contentType: e.target.value })}
              className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
            >
              <option value="">—</option>
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v[lang as "ar" | "en"]}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="space-y-1">
          <Label>{L("عدد العناصر", "Items limit")}</Label>
          <Input
            type="number"
            min={1}
            max={30}
            value={state.limit}
            onChange={(e) => setState({ ...state, limit: Number(e.target.value) })}
          />
        </div>
        <div className="space-y-1">
          <Label>{L("الترتيب", "Order")}</Label>
          <Input
            type="number"
            min={1}
            value={state.order}
            onChange={(e) => setState({ ...state, order: Number(e.target.value) })}
          />
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          <X className="size-4" />
          {L("إلغاء", "Cancel")}
        </Button>
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await upsert({
                id: section._id,
                key: section.key,
                titleAr: state.titleAr,
                titleEn: state.titleEn,
                sourceType: state.sourceType,
                contentType: state.sourceType === "type" ? state.contentType : undefined,
                limit: state.limit,
                isHidden: section.isHidden,
                order: state.order,
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
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {L("حفظ", "Save")}
        </Button>
      </div>
    </div>
  );
}

/** Pick exact titles for a manual section. */
function ManualPicker({
  sectionId,
  current,
  items,
  L,
  onDone,
  save,
}: {
  sectionId: string;
  current: string[];
  items: any[];
  L: (ar: string, en: string) => string;
  onDone: () => void;
  save: ReturnType<typeof useMutation<any>>;
}) {
  const [ids, setIds] = useState<string[]>(current);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  const filtered = items.filter((i) => i.title.includes(q) || (i.authorName ?? "").includes(q));

  return (
    <div className="mt-3 rounded-xl border bg-secondary/40 p-4">
      <Label>{L("اختر الأعمال التي تظهر في هذا القسم (بالترتيب)", "Pick the titles shown in this section (ordered)")}</Label>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={L("ابحث…", "Search…")}
        className="mt-2"
      />
      <div className="mt-3 grid max-h-64 gap-1.5 overflow-y-auto sm:grid-cols-2">
        {filtered.map((i) => {
          const active = ids.includes(i._id);
          return (
            <button
              key={i._id}
              type="button"
              onClick={() =>
                setIds(active ? ids.filter((x) => x !== i._id) : [...ids, i._id])
              }
              className={cn(
                "flex items-center gap-2 rounded-lg border p-2 text-start text-sm transition-colors",
                active ? "border-primary bg-accent/60" : "hover:bg-muted",
              )}
            >
              <img
                src={i.coverImage || "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=100&h=150&fit=crop&q=60"}
                alt=""
                className="size-9 rounded object-cover"
                loading="lazy"
              />
              <span className="min-w-0 flex-1 truncate font-semibold">{i.title}</span>
              {active && <span className="text-xs font-bold text-primary">{ids.indexOf(i._id) + 1}</span>}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          {L("إلغاء", "Cancel")}
        </Button>
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await save({ id: sectionId, itemIds: ids as any });
              toast.success(L("تم تحديث محتوى القسم", "Section items updated"));
              onDone();
            } catch (e: any) {
              toast.error(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {L("حفظ الاختيارات", "Save picks")}
        </Button>
      </div>
    </div>
  );
}
