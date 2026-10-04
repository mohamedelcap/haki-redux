import { api } from "@/convex/_generated/api";
import { SEO } from "@/components/SEO";
import { ContentCard } from "@/components/ContentCard";
import { RequireAuth } from "@/components/RequireAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { Bookmark, BookOpen, Check, ListPlus, Pencil, Trash2, X } from "lucide-react";
import { Library as LibraryIcon } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";

function LibraryInner() {
  const { lang, t } = useLang();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<string>(searchParams.get("tab") ?? "mylist");
  const [sort, setSort] = useState<"recent" | "title">("recent");

  const items = useQuery(api.library.myLibrary, {
    kind: tab as any,
  });
  const toggle = useMutation(api.library.toggleLibrary);
  const deleteByIds = useMutation(api.library.deleteContentByIds);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === rows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((r) => r._id)));
    }
  };

  const selectedIds = [...selected] as any;

  const rows = (() => {
    const arr = [...(items ?? [])];
    if (sort === "title") {
      arr.sort((a, b) =>
        (a.content?.title ?? "").localeCompare(b.content?.title ?? "", "ar"),
      );
    } else {
      arr.sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0));
    }
    return arr;
  })();

  const tabs = [
    { key: "mylist", label: t("myList"), icon: ListPlus },
    { key: "saved", label: t("savedContent"), icon: Bookmark },
    { key: "reading", label: t("readingList"), icon: BookOpen },
  ];

  const handleDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      const res = await deleteByIds({ ids: selectedIds as any });
      if (res && typeof res === "object" && "deleted" in res && res.deleted >= 0) {
        toast.success(
          lang === "ar"
            ? `${res.deleted} ${res.deleted === 1 ? t("item") : t("items")}`
            : `${res.deleted} item(s) removed from your list`,
        );
        setSelected(new Set());
        setDeleteConfirmOpen(false);
      } else {
        toast.error(lang === "ar" ? "تعذّر الحذف" : "Could not delete");
      }
    } catch (e: any) {
      toast.error(e.message || (lang === "ar" ? "تعذّر الحذف" : "Could not delete"));
    }
  };

  const handleEdit = () => {
    if (selectedIds.length === 0) return;
    for (const id of selectedIds) {
      const item = items?.find((r) => r._id === id);
      if (item?.content?.slug) {
        window.open(`/content/${item.content.slug}`, "_blank");
      }
    }
    setSelected(new Set());
  };

  return (
    <div className="py-10">
      <SEO title={`${t("myLibrary")} | حكي`} />
      <div className="haki-container">
        <h1 className="text-2xl font-black sm:text-3xl">{t("myLibrary")}</h1>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            {tabs.map((tb) => (
              <button
                key={tb.key}
                type="button"
                onClick={() => setTab(tb.key)}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                  tab === tb.key
                    ? "border-primary bg-primary text-white"
                    : "bg-background text-muted-foreground hover:bg-muted",
                )}
              >
                <tb.icon className="size-4" />
                {tb.label}
              </button>
            ))}
            <div className="ms-auto flex gap-1.5">
              {(["recent", "title"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={sort === s}
                  onClick={() => setSort(s)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                    sort === s
                      ? "border-primary bg-primary text-white"
                      : "bg-background text-muted-foreground hover:bg-muted",
                  )}
                >
                  {s === "recent"
                    ? lang === "ar"
                      ? "الأحدث"
                      : "Newest"
                    : lang === "ar"
                      ? "أبجدي"
                      : "A–Z"}
                </button>
              ))}
            </div>
          </div>

          {/* Multi-select header */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:py-1">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selected.size === rows.length}
                aria-label={t("selectAll")}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleAll();
                }}
                className="border-input"
              >
                <Check className="size-3.5" />
              </Checkbox>
              <span className="text-sm font-semibold">{selected.size}/{rows.length}</span>
            </div>
            {selected.size > 0 && (
              <Badge
                variant="secondary"
                className="cursor-pointer gap-1.5 py-1 px-2 text-xs font-semibold"
                onClick={handleEdit}
              >
                <Pencil className="size-3" />
                {t("editSelected")} ({selectedIds.length})
              </Badge>
            )}
          </div>
        </div>

        {selected.size > 0 && (
          <div className="mt-3 flex flex-col gap-2 border-t pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Alert className="border-none bg-transparent p-0 text-muted-foreground">
                <AlertTitle className="text-sm">{t("selectionNotification")}</AlertTitle>
                <AlertDescription className="text-xs">
                  {selectedIds.length} {selectedIds.length === 1 ? t("item") : t("items")} selected
                </AlertDescription>
              </Alert>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelected(new Set())}
                className="flex-1 sm:flex-none"
              >
                {t("cancel")}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteConfirmOpen(true)}
                className="flex-1 sm:flex-none"
              >
                <Trash2 className="size-4" />
                {t("deleteSelected")}
              </Button>
            </div>
          </div>
        )}

        {items === undefined ? (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <LibraryIcon className="size-12 text-muted-foreground/50" />
            <p className="text-lg font-bold">{t("myList")}</p>
            <p className="text-sm text-muted-foreground">
              {lang === "ar"
                ? "لم تضف أي محتوى بعد — تصفح المكتبة وأضف ما يعجبك"
                : "Nothing here yet — browse the library and add what you like"}
            </p>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {rows.map((row) => (
              <div key={row._id} className="group relative">
                <Checkbox
                  checked={selected.has(row._id)}
                  aria-label={`تحديد ${row.content?.title ?? "المحتوى"}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelect(row._id);
                  }}
                  className="border-input"
                >
                  <Check className="size-3.5" />
                </Checkbox>
                <button
                  type="button"
                  aria-label={lang === "ar" ? "إزالة من قائمتي" : "Remove from my list"}
                  onClick={async () => {
                    try {
                      await toggle({
                        contentId: row.contentId,
                        kind: tab as "mylist" | "saved" | "reading",
                      });
                      setSelected((prev) => {
                        const next = new Set(prev);
                        next.delete(row._id);
                        return next;
                      });
                      toast.success(
                        lang === "ar" ? "أُزيل من قائمتك" : "Removed from your list",
                      );
                    } catch (e: any) {
                      toast.error(e.message);
                    }
                  }}
                  className="absolute end-2 top-2 z-10 hidden size-7 items-center justify-center rounded-full bg-background/90 text-muted-foreground shadow-sm transition-colors hover:text-destructive group-hover:flex"
                >
                  <X className="size-4" />
                </button>
                <ContentCard item={row.content as any} />
              </div>
            ))}
          </div>
        )}

        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("deleteSelectedConfirmTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("deleteSelectedConfirmBody")} ({selectedIds.length})
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>
                {t("confirmDelete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

export default function Library() {
  return (
    <RequireAuth
      title="سجّل الدخول لعرض مكتبتك"
      description="قوائمك ومحتواك المحفوظ متاحة للمستخدمين المسجلين."
    >
      <LibraryInner />
    </RequireAuth>
  );
}
