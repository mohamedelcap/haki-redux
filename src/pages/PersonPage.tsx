import { api } from "@/convex/_generated/api";
import { SEO } from "@/components/SEO";
import { ContentCard } from "@/components/ContentCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLang } from "@/lib/i18n";
import { useQuery } from "convex/react";
import { ArrowLeft, BookOpen, Mic } from "lucide-react";
import { Link, useParams } from "react-router";
import { LOGO_COVER } from "@/lib/logoAsset";

const FALLBACK_IMAGE = LOGO_COVER;

export default function PersonPage({ kind: kindProp }: { kind?: "author" | "narrator" } = {}) {
  const params = useParams<{ kind?: string; id: string }>();
  const kind = kindProp ?? (params as any).kind ?? "author";
  const id = params.id;
  const { lang, t } = useLang();
  const L = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const personKind = kind === "narrator" ? "narrator" : "author";

  const data = useQuery(api.people.getPerson, {
    kind: personKind,
    id: id as never,
  });

  const isAuthor = personKind === "author";
  const title = data
    ? lang === "ar"
      ? data.person.name
      : data.person.nameEn || data.person.name
    : "";

  return (
    <div className="py-10">
      <SEO
        title={`${title}${isAuthor ? ` — ${L("مؤلف", "Author")}` : ` — ${L("راوٍ", "Narrator")}`} | حكي`}
        description={data?.person.bio ?? undefined}
      />
      <div className="haki-container">
        <Link to="/browse">
          <Button variant="ghost" size="sm" className="mb-6 gap-1.5">
            <ArrowLeft className="size-4" />
            {t("browse")}
          </Button>
        </Link>

        {data === undefined ? (
          <div className="flex items-center gap-6">
            <Skeleton className="size-28 rounded-full" />
            <div className="space-y-3">
              <Skeleton className="h-8 w-52" />
              <Skeleton className="h-4 w-80" />
            </div>
          </div>
        ) : data === null ? (
          <div className="rounded-2xl border bg-card p-12 text-center">
            <BookOpen className="mx-auto size-8 text-muted-foreground/50" />
            <p className="mt-3 font-bold">{L("غير موجود", "Not found")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {L("ربما تم حذف هذا الملف أو تغيّر رابطه.", "This profile may have been removed.")}
            </p>
          </div>
        ) : (
          <>
            {/* Profile header */}
            <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
              <img
                src={data.person.image || FALLBACK_IMAGE}
                alt={title}
                className="size-28 rounded-full border object-cover shadow-md"
                loading="lazy"
              />
              <div>
                <p className="text-sm font-semibold text-primary">
                  {isAuthor ? L("مؤلف", "Author") : L("راوٍ", "Narrator")}
                </p>
                <h1 className="mt-1 text-3xl font-black">{title}</h1>
                {data.person.bio && (
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    {data.person.bio}
                  </p>
                )}
                <p className="mt-3 text-sm font-semibold text-muted-foreground">
                  {data.works.length.toLocaleString(lang === "ar" ? "ar" : "en")}{" "}
                  {isAuthor ? L("عمل منشور", "published works") : L("عمل بصوته", "narrated works")}
                </p>
              </div>
            </div>

            {/* Works */}
            <section className="mt-12">
              <h2 className="text-xl font-extrabold">
                {isAuthor ? (
                  <>
                    <BookOpen className="me-2 inline size-5 text-primary" />
                    {L("أعماله", "Their works")}
                  </>
                ) : (
                  <>
                    <Mic className="me-2 inline size-5 text-primary" />
                    {L("أعمال بصوته", "Narrated by them")}
                  </>
                )}
              </h2>
              {data.works.length === 0 ? (
                <div className="mt-4 rounded-2xl border bg-card p-10 text-center">
                  <BookOpen className="mx-auto size-8 text-muted-foreground/50" />
                  <p className="mt-3 font-bold">{L("لا توجد أعمال منشورة بعد", "No published works yet")}</p>
                </div>
              ) : (
                <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {data.works.map((work) => (
                    <ContentCard key={work._id} item={work as any} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
