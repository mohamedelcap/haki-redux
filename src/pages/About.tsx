import { api } from "@/convex/_generated/api";
import { SEO } from "@/components/SEO";
import { ContentTypeIcon, TYPE_LABELS } from "@/components/ContentCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLang } from "@/lib/i18n";
import { useQuery } from "convex/react";
import {
  BookOpen,
  Building2,
  Eye,
  Mail,
  MessageCircle,
  Mic,
  Target,
  Users,
} from "lucide-react";
import { Link } from "react-router";

export default function About() {
  const { lang, t } = useLang();
  const L = (ar: string, en: string) => (lang === "ar" ? ar : en);

  return (
    <div className="py-10">
      <SEO
        title={`${t("about")} | حكي`}
        description={L(
          "حكي منصة عربية للمحتوى الرقمي والصوتي: كتب صوتية، دراما، بودكاست، ومجلات.",
          "HAKI is the Arabic platform for digital and audio content.",
        )}
      />
      <div className="haki-container max-w-4xl">
        <div className="text-center">
          <h1 className="text-3xl font-black sm:text-4xl">{t("about")}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-pretty leading-loose text-muted-foreground">
            {L(
              "حكي منصة عربية للمحتوى الرقمي والصوتي، تجمع الكتب الصوتية والإلكترونية، الدراما الصوتية، البودكاست، المجلات، والبث المباشر في مكان واحد — بصوت عربي أصيل وتجربة استخدام حديثة.",
              "HAKI is the Arabic platform for digital and audio content, combining audiobooks, ebooks, audio drama, podcasts, magazines, and live streaming in one place — with an authentic Arabic voice and a modern experience.",
            )}
          </p>
        </div>

        {/* Vision & Mission */}
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          <div className="rounded-3xl border bg-card p-7 card-shadow">
            <div className="flex size-11 items-center justify-center rounded-xl bg-accent">
              <Eye className="size-5 text-accent-foreground" />
            </div>
            <h2 className="mt-4 text-lg font-extrabold">{L("رؤية حكي", "Our vision")}</h2>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              {L(
                "أن يكون حكي المنصة العربية الأولى التي يلجأ إليها كل قارئ ومستمع للوصول إلى أفضل المحتوى العربي بجميع أشكاله.",
                "To be the first Arabic platform every reader and listener turns to for the best Arabic content in all its forms.",
              )}
            </p>
          </div>
          <div className="rounded-3xl border bg-card p-7 card-shadow">
            <div className="flex size-11 items-center justify-center rounded-xl bg-accent">
              <Target className="size-5 text-accent-foreground" />
            </div>
            <h2 className="mt-4 text-lg font-extrabold">{L("رسالة حكي", "Our mission")}</h2>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              {L(
                "تمكين المؤلفين ودور النشر وصناع المحتوى من الوصول إلى جمهورهم، وإثراء المحتوى العربي الرقمي بتجربة استماع وقراءة استثنائية.",
                "Empower authors, publishers, and creators to reach their audience, and enrich Arabic digital content with an exceptional listening and reading experience.",
              )}
            </p>
          </div>
        </div>

        {/* Content types */}
        <section className="mt-14">
          <h2 className="text-xl font-extrabold">{L("أنواع المحتوى", "Content types")}</h2>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {(["audiobook", "ebook", "audio_drama", "micro_drama", "podcast", "magazine", "live"] as const).map(
              (type) => (
                <div key={type} className="flex items-center gap-3 rounded-2xl border bg-card p-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <ContentTypeIcon type={type} className="size-5" />
                  </div>
                  <span className="text-sm font-bold">{TYPE_LABELS[type][lang]}</span>
                </div>
              ),
            )}
          </div>
        </section>

        {/* Audience cards */}
        <section className="mt-14 grid gap-5 md:grid-cols-3">
          <div className="rounded-3xl border bg-gradient-to-b from-accent/40 to-card p-7 card-shadow">
            <Users className="size-6 text-primary" />
            <h3 className="mt-3 font-extrabold">{L("المؤلفون", "Authors")}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {L(
                "انشر رواياتك وكتبك صوتيًا وإلكترونيًا واوصل إلى آلاف القراء.",
                "Publish your novels and books in audio and digital form.",
              )}
            </p>
          </div>
          <div className="rounded-3xl border bg-gradient-to-b from-accent/40 to-card p-7 card-shadow">
            <Building2 className="size-6 text-primary" />
            <h3 className="mt-3 font-extrabold">{L("دور النشر", "Publishers")}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {L(
                "وسّع وصول إصداراتك عبر منصة مخصصة للمحتوى العربي.",
                "Expand the reach of your releases on a dedicated Arabic platform.",
              )}
            </p>
          </div>
          <div className="rounded-3xl border bg-gradient-to-b from-accent/40 to-card p-7 card-shadow">
            <Mic className="size-6 text-primary" />
            <h3 className="mt-3 font-extrabold">{L("صناع المحتوى", "Creators")}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {L(
                "أطلق بودكاستك أو دراماك الصوتية وابنِ جمهورك.",
                "Launch your podcast or audio drama and build your audience.",
              )}
            </p>
          </div>
        </section>

        {/* Authors & narrators (from database) */}
        <PeopleShowcase />

        {/* Contact */}
        <section id="contact" className="mt-14 rounded-3xl bg-foreground p-8 text-center text-background sm:p-12">
          <h2 className="text-2xl font-black">{L("تواصل معنا", "Contact us")}</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-background/70">
            {L(
              "لأي استفسار أو شراكة، فريق حكي جاهز للإجابة عليك.",
              "For any inquiry or partnership, the HAKI team is ready to help.",
            )}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a href="mailto:hello@haki.example">
              <Button variant="secondary" className="gap-2 font-semibold">
                <Mail className="size-4" />
                hello@haki.example
              </Button>
            </a>
            <a
              href="https://wa.me/966500000000"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-green-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-green-700"
            >
              <MessageCircle className="size-4" />
              WhatsApp
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}

/** Authors & narrators strips, showing real profile photos from the database. */
function PeopleShowcase() {
  const { lang, t } = useLang();
  const L = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const authors = useQuery(api.content.listAuthors, {});
  const narrators = useQuery(api.content.listNarrators, {});

  const strip = (
    people: { _id: string; name: string; nameEn?: string | null; image?: string | null }[] | undefined,
  ) => (
    <div className="mt-5 flex gap-4 overflow-x-auto pb-2 no-scrollbar">
      {(people ?? Array.from({ length: 8 })).map((p: any, i: number) =>
        p?._id ? (
          <div key={p._id} className="w-28 shrink-0 text-center">
            <Avatar className="mx-auto size-24 border-2 border-background card-shadow">
              {p.image ? (
                <AvatarImage src={p.image} alt={p.name} loading="lazy" />
              ) : (
                <AvatarFallback className="bg-accent text-xl font-black text-accent-foreground">
                  {p.name.charAt(0)}
                </AvatarFallback>
              )}
            </Avatar>
            <p className="mt-2 truncate text-sm font-bold">{p.name}</p>
            <p className="truncate text-xs text-muted-foreground" dir="ltr">
              {p.nameEn}
            </p>
          </div>
        ) : (
          <div key={i} className="w-28 shrink-0">
            <Skeleton className="mx-auto size-24 rounded-full" />
            <Skeleton className="mx-auto mt-2 h-4 w-20" />
          </div>
        ),
      )}
    </div>
  );

  return (
    <>
      <section className="mt-14">
        <h2 className="text-xl font-extrabold">{L("مؤلفونا", "Our authors")}</h2>
        {strip(authors)}
      </section>
      <section className="mt-10">
        <h2 className="text-xl font-extrabold">{L("رواتنا", "Our narrators")}</h2>
        {strip(narrators)}
      </section>
    </>
  );
}
