import { useLang } from "@/lib/i18n";
import { Separator } from "@/components/ui/separator";
import { HakiLogoInline } from "@/components/HakiLogo";
import { MessageCircle } from "lucide-react";
import { Link } from "react-router";

const WHATSAPP = "https://wa.me/966500000000";

export function Footer() {
  const { lang } = useLang();

  const discover = [
    { label: lang === "ar" ? "كتب إلكترونية" : "E-books", href: "/browse/ebooks" },
    { label: lang === "ar" ? "كتب صوتية" : "Audiobooks", href: "/browse/audiobooks" },
    { label: lang === "ar" ? "دراما صوتية" : "Audio drama", href: "/browse/drama" },
    { label: lang === "ar" ? "مايكرو دراما" : "Micro drama", href: "/browse/micro-drama" },
    { label: lang === "ar" ? "بودكاست" : "Podcasts", href: "/browse/podcast" },
    { label: lang === "ar" ? "صحف ومجلات" : "Magazines", href: "/browse/magazines" },
    { label: lang === "ar" ? "بث مباشر" : "Live", href: "/live" },
  ];
  const account = [
    { label: lang === "ar" ? "الملف الشخصي" : "Profile", href: "/profile" },
    { label: lang === "ar" ? "الاشتراكات" : "Plans", href: "/subscriptions" },
    { label: lang === "ar" ? "انشر محتواك" : "Publish", href: "/publish" },
    { label: lang === "ar" ? "قوائم القراءة" : "Reading list", href: "/library" },
  ];
  const support = [
    { label: lang === "ar" ? "عن حكي" : "About HAKI", href: "/about" },
    { label: lang === "ar" ? "التحديات" : "Challenges", href: "/challenges" },
    { label: lang === "ar" ? "تواصل معنا" : "Contact us", href: "/about#contact" },
    { label: lang === "ar" ? "شروط الاستخدام" : "Terms", href: "/terms" },
    { label: lang === "ar" ? "الخصوصية" : "Privacy", href: "/privacy" },
    { label: lang === "ar" ? "حقوق النشر" : "Copyright", href: "/copyright" },
  ];

  return (
    <footer className="border-t bg-secondary/60 pb-24 lg:pb-8">
      <div className="haki-container py-12">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2.5">
              <HakiLogoInline size={44} />
            </Link>
            <p className="text-xs font-semibold text-muted-foreground">
              {lang === "ar" ? "منصة المحتوى الصوتي والرقمي" : "Arabic audio & digital content"}
            </p>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              {lang === "ar"
                ? "كتب صوتية، دراما، بودكاست، مجلات، وبث مباشر — كل ما تحب في مكان واحد."
                : "Audiobooks, drama, podcasts, magazines, and live — everything you love in one place."}
            </p>
            <div className="flex items-center gap-2">
              <a
                href={WHATSAPP}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted"
              >
                <MessageCircle className="size-3.5 text-green-600" />
                {lang === "ar" ? "تواصل عبر واتساب" : "WhatsApp us"}
              </a>
            </div>
          </div>

          <FooterColumn title={lang === "ar" ? "اكتشف" : "Discover"} links={discover} />
          <FooterColumn title={lang === "ar" ? "حسابي" : "Account"} links={account} />
          <FooterColumn title={lang === "ar" ? "الدعم" : "Support"} links={support} />
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            {lang === "ar"
              ? "جميع الحقوق محفوظة لحكي © 2026"
              : "All rights reserved to HAKI © 2026"}
          </p>
          <div className="flex items-center gap-2">
            <a
              href="https://apps.apple.com"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border bg-background px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted"
            >
               App Store
            </a>
            <a
              href="https://play.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border bg-background px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted"
            >
              ▶ Google Play
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h3 className="text-sm font-bold">{title}</h3>
      <ul className="mt-3 space-y-2.5">
        {links.map((l) => (
          <li key={l.href + l.label}>
            <Link to={l.href} className="text-sm text-muted-foreground transition-colors hover:text-primary">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
