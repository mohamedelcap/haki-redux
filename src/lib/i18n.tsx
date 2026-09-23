import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Lang = "ar" | "en";

const DICT = {
  // nav / header
  home: { ar: "الرئيسية", en: "Home" },
  browse: { ar: "تصفح", en: "Browse" },
  live: { ar: "بث مباشر", en: "Live" },
  challenges: { ar: "التحديات", en: "Challenges" },
  subscriptions: { ar: "الاشتراكات", en: "Plans" },
  search: { ar: "بحث", en: "Search" },
  publish: { ar: "انشر محتواك", en: "Publish content" },
  signIn: { ar: "تسجيل الدخول", en: "Sign in" },
  signOut: { ar: "تسجيل الخروج", en: "Sign out" },
  myAccount: { ar: "حسابي", en: "My account" },
  searchPlaceholder: { ar: "ابحث عن كتاب...", en: "Search for a book..." },
  // content types
  ebook: { ar: "كتب إلكترونية", en: "E-books" },
  audiobook: { ar: "كتب صوتية", en: "Audiobooks" },
  audio_drama: { ar: "دراما صوتية", en: "Audio drama" },
  micro_drama: { ar: "مايكرو دراما", en: "Micro drama" },
  podcast: { ar: "بودكاست", en: "Podcasts" },
  magazine: { ar: "صحف ومجلات", en: "Magazines" },
  liveType: { ar: "بث مباشر", en: "Live" },
  // sections
  mostListened: { ar: "الأكثر استماعًا", en: "Most listened" },
  newArrivals: { ar: "وصل حديثًا", en: "New arrivals" },
  hakiPicks: { ar: "اختيارات حكي", en: "HAKI picks" },
  exploreSections: { ar: "استكشف أقسام المنصة", en: "Explore the platform" },
  audioDrama: { ar: "دراما صوتية", en: "Audio drama" },
  onAirNow: { ar: "على الهواء الآن", en: "On air now" },
  noLiveNow: { ar: "لا يوجد بث مباشر حاليًا", en: "No live stream right now" },
  listenNow: { ar: "استمع الآن", en: "Listen now" },
  addToMyList: { ar: "أضف إلى قائمتي", en: "Add to my list" },
  share: { ar: "مشاركة", en: "Share" },
  chapters: { ar: "الفصول", en: "Chapters" },
  episodes: { ar: "الحلقات", en: "Episodes" },
  play: { ar: "تشغيل", en: "Play" },
  pause: { ar: "توقف", en: "Pause" },
  heroTitle: { ar: "اقرأ، استمع وعش المحتوى مع حكي", en: "Read, listen and live the content with HAKI" },
  heroSubtitle: {
    ar: "كتب صوتية، دراما، بودكاست، مجلات، وبث مباشر — كل ما تحب في مكان واحد.",
    en: "Audiobooks, drama, podcasts, magazines, and live — everything you love in one place.",
  },
  startFree: { ar: "ابدأ الآن مجانًا", en: "Start free" },
  browseLibrary: { ar: "تصفح المكتبة", en: "Browse library" },
  browseLibraryTitle: { ar: "تصفح المكتبة", en: "Browse the library" },
  filters: { ar: "الفلاتر", en: "Filters" },
  type: { ar: "النوع", en: "Type" },
  author: { ar: "الكاتب", en: "Author" },
  narrator: { ar: "الراوي", en: "Narrator" },
  category: { ar: "التصنيف", en: "Category" },
  duration: { ar: "المدة", en: "Duration" },
  sort: { ar: "الترتيب", en: "Sort" },
  newest: { ar: "الأحدث", en: "Newest" },
  mostPopular: { ar: "الأكثر استماعًا", en: "Most listened" },
  titleAz: { ar: "الاسم", en: "Title" },
  all: { ar: "الكل", en: "All" },
  results: { ar: "نتائج البحث", en: "Search results" },
  noResults: { ar: "لا توجد نتائج مطابقة", en: "No matching results" },
  tryDifferent: { ar: "جرّب كلمة بحث مختلفة", en: "Try a different search" },
  publishCtaTitle: { ar: "لديك محتوى تريد نشره؟", en: "Got content to publish?" },
  publishCtaBody: { ar: "انشر كتبك ومحتواك الصوتي مع حكي.", en: "Publish your books and audio content with HAKI." },
  footerDiscover: { ar: "اكتشف", en: "Discover" },
  footerAccount: { ar: "حسابي", en: "Account" },
  footerSupport: { ar: "الدعم", en: "Support" },
  about: { ar: "عن حكي", en: "About HAKI" },
  contact: { ar: "تواصل معنا", en: "Contact us" },
  profile: { ar: "الملف الشخصي", en: "Profile" },
  myLibrary: { ar: "مكتبتي", en: "My library" },
  myList: { ar: "قائمتي", en: "My list" },
  readingList: { ar: "قائمة القراءة", en: "Reading list" },
  lastListened: { ar: "آخر ما استمعت إليه", en: "Recently listened" },
  savedContent: { ar: "المحتوى المحفوظ", en: "Saved content" },
  settings: { ar: "الإعدادات", en: "Settings" },
  currentPlan: { ar: "الاشتراك الحالي", en: "Current plan" },
  listenHistory: { ar: "سجل الاستماع", en: "Listening history" },
  free: { ar: "مجاني", en: "Free" },
  choosePlan: { ar: "اشترك الآن", en: "Subscribe now" },
  currentPlanBadge: { ar: "خطتك الحالية", en: "Your current plan" },
  join: { ar: "المشاركة", en: "Join" },
  joined: { ar: "أنت منضم", en: "Joined" },
  participants: { ar: "مشارك", en: "participants" },
  reward: { ar: "المكافأة", en: "Reward" },
  active: { ar: "نشط", en: "Active" },
  upcoming: { ar: "قريبًا", en: "Upcoming" },
  ended: { ar: "منتهي", en: "Ended" },
  programSchedule: { ar: "جدول البرامج", en: "Program schedule" },
  host: { ar: "المقدم", en: "Host" },
  startsAt: { ar: "البداية", en: "Starts" },
  endsAt: { ar: "النهاية", en: "Ends" },
  status: { ar: "الحالة", en: "Status" },
  watchLive: { ar: "شاهد البث", en: "Watch live" },
  days: { ar: "أيام", en: "days" },
  by: { ar: "بقلم", en: "by" },
  narratedBy: { ar: "بأداء", en: "Narrated by" },
  durationLabel: { ar: "المدة", en: "Duration" },
  sectionCount: { ar: "فصل", en: "chapters" },
  episodeCount: { ar: "حلقة", en: "episodes" },
} as const;

export type TKey = keyof typeof DICT;

type LangContextValue = {
  lang: Lang;
  dir: "rtl" | "ltr";
  setLang: (lang: Lang) => void;
  t: (key: TKey) => string;
};

const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return "ar";
    return (localStorage.getItem("haki-lang") as Lang) || "ar";
  });

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem("haki-lang", l);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const t = useCallback(
    (key: TKey) => DICT[key]?.[lang] ?? DICT[key]?.ar ?? key,
    [lang],
  );

  const value = useMemo(
    () => ({ lang, dir: lang === "ar" ? ("rtl" as const) : ("ltr" as const), setLang, t }),
    [lang, setLang, t],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within LangProvider");
  return ctx;
}

/** Format seconds as hours/minutes in Arabic or English. */
export function formatDuration(seconds: number, lang: Lang = "ar") {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (lang === "ar") {
    if (h > 0) return `${h} س ${m} د`;
    return `${m} د`;
  }
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
