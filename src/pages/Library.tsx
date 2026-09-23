import { api } from "@/convex/_generated/api";
import { SEO } from "@/components/SEO";
import { ContentCard } from "@/components/ContentCard";
import { RequireAuth } from "@/components/RequireAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { Bookmark, BookOpen, ListPlus } from "lucide-react";
import { Library as LibraryIcon } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";

function LibraryInner() {
  const { lang, t } = useLang();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<string>(searchParams.get("tab") ?? "mylist");

  const items = useQuery(api.library.myLibrary, {
    kind: tab as any,
  });

  const tabs = [
    { key: "mylist", label: t("myList"), icon: ListPlus },
    { key: "saved", label: t("savedContent"), icon: Bookmark },
    { key: "reading", label: t("readingList"), icon: BookOpen },
  ];

  return (
    <div className="py-10">
      <SEO title={`${t("myLibrary")} | حكي`} />
      <div className="haki-container">
        <h1 className="text-2xl font-black sm:text-3xl">{t("myLibrary")}</h1>

        <div className="mt-6 flex gap-2">
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
        </div>

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
            {items.map((row) => (
              <div key={row._id} className="relative">
                <ContentCard item={row.content as any} />
              </div>
            ))}
          </div>
        )}
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
