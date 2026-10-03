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
  activeChallenges: { ar: "التحديات النشطة", en: "Active challenges" },
  upcomingChallenges: { ar: "قادمة قريبًا", en: "Upcoming" },
  endedChallenges: { ar: "منتهية", en: "Ended" },
  myChallenges: { ar: "تحدياتي", en: "My challenges" },
  challengeDetails: { ar: "تفاصيل التحدي", en: "Challenge details" },
  leaderboard: { ar: "لوحة الصدارة", en: "Leaderboard" },
  topFinishers: { ar: "أسرع المنجزين", en: "Top finishers" },
  yourProgress: { ar: "تقدمك", en: "Your progress" },
  joinChallenge: { ar: "انضم للتحدي", en: "Join challenge" },
  leaveChallenge: { ar: "انسحاب", en: "Leave" },
  joinedToast: { ar: "انضممت للتحدي! ابدأ الآن — تقدمك يُحسب تلقائيًا 🏆", en: "Joined! Your progress now counts automatically 🏆" },
  completedChallenge: { ar: "مكتمل", en: "Completed" },
  goal: { ar: "الهدف", en: "Goal" },
  listenMinutesGoal: { ar: "دقيقة استماع", en: "listen minutes" },
  finishedWorksGoal: { ar: "أعمال مكتملة", en: "finished works" },
  ratedItemsGoal: { ar: "تقييمات", en: "ratings" },
  noChallenges: { ar: "لا توجد تحديات حاليًا — عُد لاحقًا!", en: "No challenges right now — check back soon!" },
  joinBeforeStart: { ar: "انضم الآن قبل انطلاقها", en: "Join before it starts" },
  emptyMyChallenges: { ar: "لم تنضم لأي تحدٍ بعد — التحديات طريقة ممتعة لبناء عادة الاستماع اليومية.", en: "You haven't joined any challenge yet — challenges are a fun way to build a daily listening habit." },
  challengeProgressHint: { ar: "يُحسب تقدمك تلقائيًا من استماعك الفعلي خلال فترة التحدي", en: "Progress is computed automatically from your listening during the challenge period" },
  rank: { ar: "المركز", en: "Rank" },
  subscriptions: { ar: "الاشتراكات", en: "Plans" },
  search: { ar: "بحث", en: "Search" },
  publish: { ar: "انشر محتواك", en: "Publish content" },
  signIn: { ar: "تسجيل الدخول", en: "Sign in" },
  signOut: { ar: "تسجيل الخروج", en: "Sign out" },
  myAccount: { ar: "حسابي", en: "My account" },
  searchPlaceholder: { ar: "ابحث عن كتاب...", en: "Search for a book..." },
  notifications: { ar: "الإشعارات", en: "Notifications" },
  markAllRead: { ar: "تحديد الكل كمقروء", en: "Mark all read" },
  noNotifications: { ar: "لا إشعارات حتى الآن", en: "No notifications yet" },
  markRead: { ar: "تحديد كمقروء", en: "Mark as read" },
  myDashboard: { ar: "لوحتي", en: "My dashboard" },
  ratings: { ar: "التقييمات والمراجعات", en: "Ratings & reviews" },
  followShow: { ar: "متابعة البرنامج", en: "Follow show" },
  following: { ar: "متابَع", en: "Following" },
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
  heroTitle: { ar: "اقرأ، استمع وعش المحتوى مع حكي", en: "Read, listen, and live the content with HAKI" },
  heroSubtitle: {
    ar: "كتب صوتية، دراما، بودكاست، مجلات، وبث مباشر — كل ما تحب في مكان واحد.",
    en: "Audiobooks, drama, podcasts, magazines, and live — everything you love in one place.",
  },
  startFree: { ar: "ابدأ الآن مجانًا", en: "Start free" },
  browseLibrary: { ar: "تصفح المكتبة", en: "Browse library" },
  browseLibraryTitle: { ar: "تصفح المكتبة", en: "Browse the library" },
  viewAll: { ar: "عرض الكل", en: "View all" },
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
  publishCtaTitle: { ar: "لديك محتوى تريد نشره؟", en: "Do you have content to publish?" },
  publishCtaBody: { ar: "انشر كتبك ومحتواك الصوتي مع حكي واوصل إلى مستمعين في كل العالم العربي.", en: "Publish your books and audio with HAKI and reach listeners across the Arab world." },
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
  topRated: { ar: "الأعلى تقييمًا", en: "Top rated" },
  suggestions: { ar: "اقتراحات", en: "Suggestions" },
  // ---- challenges experience (list & details) ----
  challengesHeroTitle: { ar: "استمع أكثر، وأنجز أكثر", en: "Listen more, achieve more" },
  challengesHeroSubtitle: {
    ar: "تقدّمك يُحسب تلقائيًا من استماعك اليومي — انضم للتحدي، واستمر في الاستماع، واحصد المكافأة.",
    en: "Your progress counts automatically from your daily listening — join a challenge, keep listening, and earn the reward.",
  },
  challengesHeroCta: { ar: "استكشف التحديات", en: "Explore challenges" },
  startFirstChallenge: { ar: "ابدأ أول تحدٍ", en: "Start your first challenge" },
  challengesRelisten: { ar: "بقية التحديات", en: "Browse challenges" },
  statActive: { ar: "نشط الآن", en: "Active now" },
  statUpcoming: { ar: "قادم قريبًا", en: "Upcoming" },
  statMine: { ar: "أكملته", en: "Completed by you" },
  statMinutes: { ar: "دقائق ضمن التحديات", en: "Minutes in challenges" },
  tabAll: { ar: "الكل", en: "All" },
  tabMine: { ar: "تحدياتي", en: "My challenges" },
  daysLeft: { ar: "يوم متبقٍ", en: "days left" },
  daysLeftOne: { ar: "يوم متبقٍ واحد", en: "1 day left" },
  startsIn: { ar: "يبدأ بعد", en: "Starts in" },
  daysToStart: { ar: "أيام", en: "days" },
  daysToStartOne: { ar: "يوم واحد", en: "1 day" },
  withinDays: { ar: "خلال", en: "in" },
  joinSignInFirst: { ar: "سجّل الدخول للانضمام", en: "Sign in to join" },
  continueProgress: { ar: "متابعة التقدم", en: "Continue progress" },
  notStartedYet: { ar: "التحدي لم يبدأ بعد", en: "Challenge not started yet" },
  viewResults: { ar: "عرض النتائج", en: "View results" },
  emptyActive: { ar: "لا توجد تحديات نشطة حاليًا", en: "No active challenges right now" },
  emptyActiveBody: { ar: "سنطلق تحديات جديدة قريبًا — استكشف المكتبة واستمع حتى ذلك الحين.", en: "New challenges are coming soon — explore the library and keep listening meanwhile." },
  emptyUpcoming: { ar: "لا توجد تحديات قادمة", en: "No upcoming challenges" },
  emptyUpcomingBody: { ar: "تابعنا ليصلك كل جديد — أو انضم لأحد التحديات النشطة الآن.", en: "Stay tuned — or join one of the active challenges now." },
  emptyEnded: { ar: "لا توجد تحديات منتهية بعد", en: "No ended challenges yet" },
  emptyEndedBody: { ar: "عند انتهاء أول تحدٍ ستجد نتائجه هنا.", en: "Once the first challenge ends, its results will appear here." },
  emptyMine: { ar: "لم تنضم لأي تحدٍ بعد", en: "You haven't joined any challenge yet" },
  emptyMineBody: { ar: "اختر تحديًا نشطًا وابدأ رحلتك — كل دقيقة استماع تُحتسب تلقائيًا.", en: "Pick an active challenge and start — every listening minute counts automatically." },
  backToActive: { ar: "استكشف التحديات النشطة", en: "Explore active challenges" },
  streakCurrent: { ar: "سلسلتك الحالية", en: "Current streak" },
  streakBest: { ar: "أفضل سلسلة", en: "Best streak" },
  todayDone: { ar: "استمعت اليوم، أحسنت!", en: "You listened today — well done!" },
  todayRemaining: { ar: "لم تستمع اليوم بعد — استمع الآن لتحافظ على سلسلتك", en: "No listening today yet — tune in to keep your streak" },
  remainingToGoal: { ar: "تبقى لك", en: "Remaining" },
  toComplete: { ar: "لإكمال التحدي", en: "to complete the challenge" },
  minutesUnit: { ar: "دقيقة", en: "minutes" },
  dayUnit: { ar: "يوم", en: "day" },
  daysUnit: { ar: "يوم", en: "days" },
  completedDays: { ar: "الأيام المكتملة", en: "Days completed" },
  listenToProgress: { ar: "اكتشف كتبًا صوتية مناسبة", en: "Discover audiobooks for you" },
  challengeCompletedTitle: { ar: "أكملت التحدي 🎉", en: "Challenge completed 🎉" },
  challengeCompletedBody: { ar: "أحسنت! أُنجز الهدف كاملًا — تُسلّم المكافأة تلقائيًا.", en: "Great job! Goal fully achieved — the reward is delivered automatically." },
  upcomingNote: { ar: "التحدي لم يبدأ بعد — انضم الآن وسيُحتسب استماعك من يوم الانطلاق.", en: "This challenge hasn't started yet — join now and your listening counts from day one." },
  endedNote: { ar: "انتهى هذا التحدي — يمكنك استعراض النتائج أدناه.", en: "This challenge has ended — browse the results below." },
  whatYoullGet: { ar: "ماذا سيحقق لك هذا التحدي؟", en: "What will you get from this challenge?" },
  howMinutesCount: { ar: "كيف تُحتسب الدقائق؟", en: "How are minutes counted?" },
  successConditions: { ar: "شروط النجاح", en: "Success conditions" },
  whenStartEnd: { ar: "متى يبدأ ومتى ينتهي؟", en: "When does it start and end?" },
  rewardOnFinish: { ar: "ماذا تحصل عليه عند الإكمال؟", en: "What do you get when you finish?" },
  joinCtaSignin: { ar: "أنشئ حسابًا وانضم مجانًا", en: "Create an account & join free" },
  totalDays: { ar: "إجمالي الأيام", en: "Total days" },
  yourRank: { ar: "مركزك", en: "Your rank" },
  notOnBoard: { ar: "انضم للتحدي لتظهر في لوحة الصدارة", en: "Join the challenge to appear on the board" },
  noParticipants: { ar: "لا مشاركين بعد — كن أول المتسابقين!", en: "No participants yet — be the first!" },
  faqTitle: { ar: "القواعد والأسئلة الشائعة", en: "Rules & FAQ" },
  faqCount: { ar: "ما الذي يُحتسب ضمن التحدي؟", en: "What counts toward the challenge?" },
  faqCountBody: { ar: "كل ما تستمع إليه فعليًا داخل حكي: كتب صوتية، دراما، بودكاست، ومجلات. يُحتسب فقط الاستماع الحقيقي خلال فترة التحدي.", en: "Everything you actually listen to inside HAKI: audiobooks, drama, podcasts, and magazines. Only real listening during the challenge period counts." },
  faqUpdate: { ar: "متى يتحدّث التقدم؟", en: "When does progress update?" },
  faqUpdateBody: { ar: "يتحدث تلقائيًا أثناء وبعد جلسات الاستماع — لا تحتاج لتسجيل أي شيء يدويًا.", en: "Automatically during and after your listening sessions — no manual logging needed." },
  faqMultiple: { ar: "هل يمكن الاستماع لأكثر من محتوى؟", en: "Can I listen to more than one title?" },
  faqMultipleBody: { ar: "نعم — اجمع دقائقك من أي محتوى على المنصة، وهي كلها تُحتسب ضمن هدف التحدي.", en: "Yes — minutes from any title on the platform all count toward the challenge goal." },
  faqMissed: { ar: "ماذا يحدث عند تفويت يوم؟", en: "What happens if I miss a day?" },
  faqMissedBody: { ar: "تتوقف سلسلتك الحالية وتبدأ من جديد عند عودة الاستماع، لكن دقائقك المتراكمة نحو الهدف لا تُفقد.", en: "Your current streak resets, but the minutes you've banked toward the goal are never lost." },
  faqReward: { ar: "متى تُسلّم المكافأة؟", en: "When is the reward delivered?" },
  faqRewardBody: { ar: "فور إكمال الهدف — يظهر إشعار الإنجاز وتُسلّم المكافأة تلقائيًا إلى حسابك.", en: "Right after completing the goal — a completion notification appears and the reward is delivered automatically." },
  faqOffline: { ar: "هل يُحتسب الاستماع دون اتصال؟", en: "Does offline listening count?" },
  faqOfflineBody: { ar: "تُحتسب الجلسات عند مزامنتها مع الخادم بعد عودة الاتصال.", en: "Sessions count once they sync with the server after you're back online." },
  loadError: { ar: "تعذّر تحميل التحديات", en: "Couldn't load challenges" },
  loadErrorBody: { ar: "حدث خطأ أثناء جلب البيانات — تحقق من اتصالك ثم أعد المحاولة.", en: "Something went wrong while fetching data — check your connection and retry." },
  retry: { ar: "إعادة المحاولة", en: "Retry" },
  minutesOf: { ar: "من", en: "of" },
  minutesUnitShort: { ar: "د", en: "min" },
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
