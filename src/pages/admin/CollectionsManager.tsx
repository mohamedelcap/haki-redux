import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLang } from "@/lib/i18n";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  LayoutGrid,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type CollectionRow = {
  _id: string;
  slug: string;
  titleAr: string;
  titleEn?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  coverImage?: string;
  itemIds: string[];
  isHidden?: boolean;
  order: number;
};

type ContentRow = {
  _id: string;
  title: string;
  coverImage?: string;
  contentType: string;
  status: string;
};

/**
 * Admin manager for curated collections (/collections public page).
 * Items are picked from published content and ordered manually.
 */
export function CollectionsManager({ L }: { L: (ar: string, en: string) => string }) {
  const collections = useQuery(api.collections.listAdmin, {});
  const allContent = useQuery(api.content.listAllForAdmin, {});
  const upsert = useMutation(api.collections.upsert);
  const remove = useMutation(api.collections.remove);
  const [editing, setEditing] = useState<Partial<CollectionRow> | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const published = (allContent ?? []).filter(
    (c: ContentRow) => c.status === "published",
  ) as ContentRow[];
  const matches = (c: ContentRow) =>
    !search.trim() || c.title.toLowerCase().includes(search.trim().toLowerCase());

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const form = new FormData(e.currentTarget as HTMLFormElement);
    setSaving(true);
    try {
      await upsert({
        id: editing._id as never,
        slug: String(form.get("slug")),
        titleAr: String(form.get("titleAr")),
        titleEn: String(form.get("titleEn") ?? "") || undefined,
        descriptionAr: String(form.get("descriptionAr") ?? "") || undefined,
        descriptionEn: String(form.get("descriptionEn") ?? "") || undefined,
        coverImage: String(form.get("coverImage") ?? "") || undefined,
        itemIds: (editing.itemIds ?? []) as never,
        isHidden: form.get("isHidden") !== "on",
      });
      toast.success(L("تم الحفظ", "Saved"));
      setEditing(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleItem = (id: string) => {
    if (!editing) return;
    const ids = editing.itemIds ?? [];
    setEditing({
      ...editing,
      itemIds: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    });
  };

  const moveItem = (index: number, dir: -1 | 1) => {
    if (!editing) return;
    const ids = [...(editing.itemIds ?? [])];
    const target = index + dir;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setEditing({ ...editing, itemIds: ids });
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-black">
          <LayoutGrid className="size-5 text-primary" />
          {L("المجموعات المنسقة", "Curated collections")}
        </h2>
        <Button
          className="font-bold"
          onClick={() => setEditing({ itemIds: [], isHidden: false, order: 99 })}
        >
          <Plus className="size-4" />
          {L("مجموعة جديدة", "New collection")}
        </Button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {L(
          "تظهر المجموعات المرئية في صفحة /collections العامة بترتيبها المحدد.",
          "Visible collections appear on the public /collections page in their defined order.",
        )}
      </p>

      {collections === undefined ? (
        <div className="mt-6 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : collections.length === 0 ? (
        <div className="mt-6 rounded-2xl border bg-card p-10 text-center">
          <LayoutGrid className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-3 font-bold">{L("لا مجموعات بعد", "No collections yet")}</p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {collections.map((c: CollectionRow) => (
            <div key={c._id} className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-4">
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-bold">
                  {c.titleAr}
                  {c.isHidden && (
                    <Badge variant="outline" className="text-[10px]">
                      {L("مخفية", "hidden")}
                    </Badge>
                  )}
                </span>
                <span className="text-xs text-muted-foreground" dir="ltr">
                  /collections · {c.slug} · {c.itemIds.length} {L("عنصرًا", "items")}
                </span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={L("إظهار/إخفاء", "Toggle visibility")}
                onClick={async () => {
                  await upsert({
                    id: c._id as never,
                    slug: c.slug,
                    titleAr: c.titleAr,
                    titleEn: c.titleEn || undefined,
                    descriptionAr: c.descriptionAr || undefined,
                    descriptionEn: c.descriptionEn || undefined,
                    coverImage: c.coverImage || undefined,
                    itemIds: c.itemIds as never,
                    isHidden: !c.isHidden,
                    order: c.order,
                  });
                }}
              >
                {c.isHidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
              <Button variant="ghost" size="icon" aria-label={L("تعديل", "Edit")} onClick={() => setEditing(c)}>
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={L("حذف", "Delete")}
                onClick={async () => {
                  if (!confirm(L("تأكيد الحذف؟", "Confirm delete?"))) return;
                  await remove({ id: c._id as never });
                  toast.success(L("تم الحذف", "Deleted"));
                }}
              >
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Editor */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <form onSubmit={save} className="my-8 grid w-full max-w-3xl gap-5 rounded-3xl border bg-background p-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black">
                  {editing._id ? L("تعديل مجموعة", "Edit collection") : L("مجموعة جديدة", "New collection")}
                </h3>
                <Button type="button" variant="ghost" size="icon" onClick={() => setEditing(null)}>
                  <X className="size-4" />
                </Button>
              </div>
              <div className="space-y-1.5">
                <Label>Slug *</Label>
                <Input name="slug" defaultValue={editing.slug ?? ""} required dir="ltr" placeholder="arabic-poetry" />
              </div>
              <div className="space-y-1.5">
                <Label>{L("العنوان (عربي)", "Title (Arabic)")} *</Label>
                <Input name="titleAr" defaultValue={editing.titleAr ?? ""} required />
              </div>
              <div className="space-y-1.5">
                <Label>{L("العنوان (إنجليزي)", "Title (English)")}</Label>
                <Input name="titleEn" defaultValue={editing.titleEn ?? ""} dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label>{L("وصف (عربي)", "Description (Arabic)")}</Label>
                <Textarea name="descriptionAr" defaultValue={editing.descriptionAr ?? ""} rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label>{L("وصف (إنجليزي)", "Description (English)")}</Label>
                <Textarea name="descriptionEn" defaultValue={editing.descriptionEn ?? ""} rows={2} dir="ltr" />
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" name="isHidden" defaultChecked={editing.isHidden !== true} />
                {L("مرئية في الموقع", "Visible on site")}
              </label>
              <div className="flex justify-end">
                <Button type="submit" disabled={saving} className="font-bold">
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  {L("حفظ", "Save")}
                </Button>
              </div>
            </div>

            {/* Item picker */}
            <div className="space-y-3">
              <Label>{L("عناصر المجموعة (بالترتيب)", "Collection items (ordered)")}</Label>
              {(editing.itemIds ?? []).length > 0 && (
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border p-2">
                  {(editing.itemIds ?? []).map((id, i) => {
                    const row = published.find((c) => c._id === id);
                    return (
                      <div key={id} className="flex items-center gap-1.5 rounded-lg bg-secondary/60 px-2 py-1.5 text-sm">
                        <span className="min-w-0 flex-1 truncate font-semibold">{row?.title ?? id}</span>
                        <Button type="button" variant="ghost" size="icon" className="size-6" onClick={() => moveItem(i, -1)} aria-label={L("أعلى", "Up")}>
                          <ArrowUp className="size-3" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="size-6" onClick={() => moveItem(i, 1)} aria-label={L("أسفل", "Down")}>
                          <ArrowDown className="size-3" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="size-6" onClick={() => toggleItem(id)} aria-label={L("إزالة", "Remove")}>
                          <X className="size-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={L("بحث لإضافة عنصر…", "Search to add items…")}
              />
              <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border p-2">
                {published.filter(matches).map((c) => {
                  const picked = (editing.itemIds ?? []).includes(c._id);
                  return (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => toggleItem(c._id)}
                      className={
                        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-sm transition-colors " +
                        (picked ? "bg-primary/10 text-primary" : "hover:bg-muted")
                      }
                    >
                      <span className="min-w-0 flex-1 truncate font-semibold">{c.title}</span>
                      {picked && <Badge className="bg-primary text-white">{L("مضاف", "added")}</Badge>}
                    </button>
                  );
                })}
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
