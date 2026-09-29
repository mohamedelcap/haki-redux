import { api } from "@/convex/_generated/api";
import type { EnrichedContent } from "@/convex/lib";
import { SEO } from "@/components/SEO";
import { ContentCard } from "@/components/ContentCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useLang } from "@/lib/i18n";
import { useQuery } from "convex/react";
import { LayoutGrid } from "lucide-react";
import { Link } from "react-router";

type Collection = {
  _id: string;
  slug: string;
  titleAr: string;
  titleEn?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  coverImage?: string;
  items: EnrichedContent[];
};

/**
 * Public curated collections page (/collections): admin-managed shelves,
 * each rendering a horizontal strip of content cards.
 */
export default function Collections() {
  const { lang } = useLang();
  const L = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const collections = useQuery(api.collections.listPublic, {});

  return (
    <div className="py-10">
      <SEO
        title={`${L("المجموعات", "Collections")} | حكي`}
        description={L(
          "مجموعات منسقة من فريق حكي: روايات، شعر، تاريخ، وأكثر.",
          "Curated collections by the HAKI team: novels, poetry, history, and more.",
        )}
      />
      <div className="haki-container">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10">
            <LayoutGrid className="size-6 text-primary" />
          </span>
          <div>
            <h1 className="text-2xl font-black sm:text-3xl">{L("المجموعات المنسقة", "Curated collections")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {L(
                "تشكيلات يختارها فريق حكي بعناية من المكتبة.",
                "Hand-picked selections from the HAKI library.",
              )}
            </p>
          </div>
        </div>

        {collections === undefined ? (
          <div className="mt-8 space-y-8">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-7 w-48" />
                <div className="flex gap-4 overflow-hidden">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Skeleton key={j} className="aspect-[3/4] w-36 shrink-0 rounded-xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : collections.length === 0 ? (
          <div className="mt-10 rounded-2xl border bg-card p-10 text-center">
            <LayoutGrid className="mx-auto size-8 text-muted-foreground/50" />
            <p className="mt-3 font-bold">{L("لا توجد مجموعات بعد", "No collections yet")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {L(
                "ستظهر هنا المجموعات فور نشرها من لوحة الإدارة.",
                "Collections appear here as soon as they are published from the admin dashboard.",
              )}
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-12">
            {collections.map((c: Collection) => (
              <section key={c._id}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h2 className="text-xl font-black">
                      {lang === "ar" ? c.titleAr : c.titleEn || c.titleAr}
                    </h2>
                    {(lang === "ar" ? c.descriptionAr : c.descriptionEn || c.descriptionAr) && (
                      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                        {lang === "ar" ? c.descriptionAr : c.descriptionEn || c.descriptionAr}
                      </p>
                    )}
                  </div>
                  <Link
                    to="/browse"
                    className="text-sm font-bold text-primary hover:underline"
                  >
                    {L("تصفح المكتبة", "Browse the library")}
                  </Link>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {c.items.map((item) => (
                    <ContentCard key={item._id} item={item} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
