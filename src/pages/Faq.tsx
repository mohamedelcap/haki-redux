import { SEO } from "@/components/SEO";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useLang } from "@/lib/i18n";
import { CircleHelp } from "lucide-react";
import { Link } from "react-router";

type QA = { q: { ar: string; en: string }; a: { ar: string; en: string } };
type Group = { title: { ar: string; en: string }; items: QA[] };

const GROUPS: Group[] = [
  {
    title: { ar: "عن المنصة", en: "About the platform" },
    items: [
      {
        q: { ar: "ما هي منصة حكي؟", en: "What is HAKI?" },
        a: {
          ar: "حكي منصة عربية للمحتوى الصوتي والرقمي: كتب صوتية، كتب إلكترونية، دراما صوتية، بودكاست، ومجلات — كلها في مكان واحد.",
          en: "HAKI is an Arabic platform for audio and digital content: audiobooks, e-books, audio drama, podcasts, and magazines — all in one place.",
        },
      },
      {
        q: { ar: "هل المحتوى مجاني؟", en: "Is the content free?" },
        a: {
          ar: "جزء كبير من المكتبة مجاني، وخصوصًا أعمال الملك العام. استخدم فلتر «مجاني» في صفحة التصفح لعرضها. الباقات المدفوعة تفتح محتوى إضافيًا حصريًا.",
          en: "A large part of the library is free, especially public-domain works. Use the “Free” filter on the browse page to see it. Paid plans unlock additional exclusive content.",
        },
      },
    ],
  },
  {
    title: { ar: "الاستماع والقراءة", en: "Listening & reading" },
    items: [
      {
        q: { ar: "هل يمكنني القراءة بدون إنترنت؟", en: "Can I read offline?" },
        a: {
          ar: "يمكنك تحميل ملفات الكتب الإلكترونية (PDF/EPUB) من صفحة الكتاب وقراءتها على جهازك، والاستماع داخل المنصة يكمل تلقائيًا من حيث توقفت.",
          en: "You can download e-book files (PDF/EPUB) from the book page and read them on your device, and in-app playback continues from where you stopped.",
        },
      },
      {
        q: { ar: "كيف أكمل الاستماع من حيث توقفت؟", en: "How does resume work?" },
        a: {
          ar: "يحفظ المشغّل موضعك تلقائيًا لكل عمل — ارجع في أي وقت من قائمة «مكتبتي» أو سجل الاستماع.",
          en: "The player saves your position automatically for each work — return anytime from “My library” or your listening history.",
        },
      },
    ],
  },
  {
    title: { ar: "الناشرون والمؤلفون", en: "Publishers & authors" },
    items: [
      {
        q: { ar: "كيف أنشر عملي على حكي؟", en: "How do I publish my work?" },
        a: {
          ar: "من صفحة «انشر محتواك» أرسل طلبًا، وبعد مراجعة الفريق يصبح حسابك ناشرًا أو مؤلفًا وتدير أعمالك من الاستوديو.",
          en: "From the “Publish” page, submit a request; after review your account becomes a publisher/author and you manage works from the studio.",
        },
      },
      {
        q: { ar: "كيف تُحسب الأرباح؟", en: "How are royalties calculated?" },
        a: {
          ar: "توزيع الأرباح يعتمد على الاستماع الفعلي للأعمال خلال الفترة، وتصدر كشوفات دورية للناشرين والرواة من لوحة التوزيع.",
          en: "Royalties are based on actual listening during the period, with periodic statements issued to publishers and narrators.",
        },
      },
    ],
  },
  {
    title: { ar: "الدعم والبلاغات", en: "Support & reports" },
    items: [
      {
        q: { ar: "أوجدت مشكلة في كتاب أو صفحة — ماذا أفعل؟", en: "I found a problem — what do I do?" },
        a: {
          ar: "استخدم زر «أوجد مشكلة في هذه الصفحة؟ أبلغ عنها» أسفل صفحة المحتوى؛ بلاغك يصل للفريق مباشرة ويظهر علنًا في صفحة شفافية البلاغات.",
          en: "Use the “Found a problem on this page? Report it” button at the bottom of any content page; your report reaches the team directly and appears publicly on the transparency page.",
        },
      },
      {
        q: { ar: "أين أتابع البلاغات المرفوعة؟", en: "Where can I follow submitted reports?" },
        a: {
          ar: "كل البلاغات العامة متاحة في صفحة «شفافية البلاغات»، ويمكنك التواصل معنا مباشرة من صفحة عن حكي.",
          en: "All public reports are listed on the transparency page, and you can contact us directly from the About page.",
        },
      },
    ],
  },
];

/** Public FAQ page (/faq). */
export default function Faq() {
  const { lang } = useLang();
  const L = (ar: string, en: string) => (lang === "ar" ? ar : en);

  return (
    <div className="py-10">
      <SEO
        title={`${L("الأسئلة الشائعة", "FAQ")} | حكي`}
        description={L(
          "أجوبة سريعة عن المنصة: المحتوى المجاني، الاستماع، النشر، والبلاغات.",
          "Quick answers about the platform: free content, listening, publishing, and reports.",
        )}
      />
      <div className="haki-container max-w-3xl">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10">
            <CircleHelp className="size-6 text-primary" />
          </span>
          <div>
            <h1 className="text-2xl font-black sm:text-3xl">{L("الأسئلة الشائعة", "Frequently asked questions")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {L("أسرع طريق لإجابة سؤالك عن حكي.", "The fastest way to an answer about HAKI.")}
            </p>
          </div>
        </div>

        {GROUPS.map((g) => (
          <section key={g.title.en} className="mt-8">
            <h2 className="text-lg font-extrabold">{g.title[lang as "ar" | "en"]}</h2>
            <Accordion type="single" collapsible className="mt-3">
              {g.items.map((qa) => (
                <AccordionItem key={qa.q.en} value={qa.q.en}>
                  <AccordionTrigger className="text-start text-sm font-bold">
                    {qa.q[lang as "ar" | "en"]}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                    {qa.a[lang as "ar" | "en"]}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        ))}

        <p className="mt-10 text-sm text-muted-foreground">
          {L("لم تجد إجابتك؟", "Didn't find your answer?")}{" "}
          <Link to="/about#contact" className="font-bold text-primary hover:underline">
            {L("تواصل معنا", "Contact us")}
          </Link>
        </p>
      </div>
    </div>
  );
}
