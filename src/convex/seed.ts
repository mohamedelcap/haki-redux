import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireAdmin, getCurrentUser } from "./lib";

/**
 * Bootstrap guard: allows the FIRST seed run before any admin exists.
 * Once at least one admin user exists, seeding requires admin privileges.
 */
async function requireSeedAccess(ctx: any) {
  const admins = await ctx.db
    .query("users")
    .filter((q: any) => q.eq(q.field("role"), "admin"))
    .take(1);
  if (admins.length === 0) {
    const user = await getCurrentUser(ctx);
    if (user) {
      // First authenticated user bootstraps into the admin role.
      await ctx.db.patch(user._id, { role: "admin" });
    }
    return;
  }
  await requireAdmin(ctx);
}

// Deterministic hash for stable demo data
function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const AUTHORS = [
  { name: "نجيب محفوظ", nameEn: "Naguib Mahfouz" },
  { name: "أحمد خالد مصطفى", nameEn: "Ahmed Khaled Mostafa" },
  { name: "غادة عبد العال", nameEn: "Ghada Abdel Aal" },
  { name: "إيهاب ملاوي", nameEn: "Ehab Malawi" },
  { name: "منال الشريف", nameEn: "Manal Al-Sharif" },
  { name: "سعود السنعوسي", nameEn: "Saud Alsanosi" },
  { name: "أحمد المراغي", nameEn: "Ahmed El-Maraaghy" },
  { name: "ريم الكمالي", nameEn: "Reem Al-Kamali" },
  { name: "إبراهيم نصر الله", nameEn: "Ibrahim Nasrallah" },
  { name: "ياسمين الخاتم", nameEn: "Yasmin Al-Khatib" },
];

const NARRATORS = [
  { name: "عمر الهاشمي", nameEn: "Omar Al-Hashimi" },
  { name: "سلمى الأيوبي", nameEn: "Salma Al-Ayoubi" },
  { name: "خالد الجابري", nameEn: "Khaled Al-Jabri" },
  { name: "نورة الشامسي", nameEn: "Noura Al-Shamsi" },
  { name: "ياسر الشريف", nameEn: "Yasser Al-Sharif" },
  { name: "هالة عياد", nameEn: "Hala Ayad" },
  { name: "مصطفى سعد", nameEn: "Mostafa Saad" },
  { name: "ليان المطيري", nameEn: "Layan Al-Mutairi" },
];

const PUBLISHERS = [
  { name: "دار الساقي", nameEn: "Saqi Books" },
  { name: "دار التنوير", nameEn: "Dar Al Tanweer" },
  { name: "منشورات حكي", nameEn: "HAKI Publishing" },
  { name: "دار الشروق", nameEn: "Dar Al Shorouk" },
];

const CATEGORIES = [
  { name: "روايات", nameEn: "Novels", slug: "novels" },
  { name: "تنمية ذاتية", nameEn: "Self Development", slug: "self-development" },
  { name: "تاريخ", nameEn: "History", slug: "history" },
  { name: "فانتازيا", nameEn: "Fantasy", slug: "fantasy" },
  { name: "أدب عربي", nameEn: "Arabic Literature", slug: "arabic-literature" },
  { name: "بزنس", nameEn: "Business", slug: "business" },
  { name: "علم", nameEn: "Science", slug: "science" },
  { name: "سينما ومسلسلات", nameEn: "Cinema & Series", slug: "cinema" },
  { name: "صحة ونفسية", nameEn: "Health & Psychology", slug: "health" },
];

type ContentSeed = {
  title: string;
  slug: string;
  description: string;
  contentType:
    | "ebook"
    | "audiobook"
    | "audio_drama"
    | "micro_drama"
    | "podcast"
    | "magazine"
    | "live";
  author: string;
  narrator?: string;
  publisher?: string;
  categorySlugs: string[];
  episodes?: number; // episode/chapter count
  minutes: number;
  daysAgo: number;
  isFeatured?: boolean;
  isTrending?: boolean;
  isNew?: boolean;
};

const CONTENTS: ContentSeed[] = [
  { title: "أولاد حارتنا", slug: "awlad-haretina", description: "رواية سحرية عن حارة معزولة يسكنها الناس ويمرّ بهم الحاج متولي، وفيها معاناة البحث عن المعنى والحياة. واحدة من أعظم الروايات العربية الحديثة.", contentType: "audiobook", author: "نجيب محفوظ", narrator: "عمر الهاشمي", publisher: "دار الشروق", categorySlugs: ["novels", "arabic-literature"], episodes: 12, minutes: 540, daysAgo: 120, isFeatured: true, isTrending: true },
  { title: "أرض اليقين", slug: "ard-alyaqin", description: "في محاولة للإجابة عن سؤال: هل حياتنا محكومة من قبل قدر خفي؟ يأخذنا أحمد خالد مصطفى في رحلة فكرية عن اليقين والحرية.", contentType: "audiobook", author: "أحمد خالد مصطفى", narrator: "خالد الجابري", publisher: "دار التنوير", categorySlugs: ["novels", "arabic-literature"], episodes: 10, minutes: 420, daysAgo: 45, isTrending: true },
  { title: "أنا وهيكات وأميرة", slug: "ana-we-hykat-we-amira", description: "مجموعة مقالات ساخرة عن السوريال في مصر من واقع تجارب المؤلفة اليومية، بأسلوب مرح وصادق.", contentType: "audiobook", author: "غادة عبد العال", narrator: "سلمى الأيوبي", publisher: "دار الساقي", categorySlugs: ["arabic-literature"], episodes: 8, minutes: 260, daysAgo: 30, isNew: true, isTrending: true },
  { title: "فاتورة روح", slug: "fatoora-rooh", description: "رواية عن شاب يفتح فاتورة لحياته ويحاول أن يدفع ثمن أخطائه، في رحلة بين الحقيقة والخيال.", contentType: "audiobook", author: "إيهاب ملاوي", narrator: "مصطفى سعد", publisher: "منشورات حكي", categorySlugs: ["novels"], episodes: 14, minutes: 610, daysAgo: 60, isFeatured: true },
  { title: "ليلة في عيونها", slug: "layla-fi-oyounha", description: "قصة قصيرة صوتية عن ليلة تتغير فيها حياة فتاة بالكامل بعد لقاء عابر.", contentType: "micro_drama", author: "ريم الكمالي", narrator: "ليان المطيري", categorySlugs: ["novels"], episodes: 5, minutes: 85, daysAgo: 15, isNew: true },
  { title: "سر الفراشة", slug: "sirr-alfarasha", description: "من غموض دراما التشويق، تختفي طالبة جامعية ويبدأ صديقها رحلة البحث التي تكشف أسراراً لم يكن يتوقعها.", contentType: "audio_drama", author: "ياسمين الخاتم", narrator: "نورة الشامسي", categorySlugs: ["novels", "cinema"], episodes: 10, minutes: 300, daysAgo: 25, isTrending: true, isFeatured: true },
  { title: "منصور تيك توك", slug: "mansour-tiktok", description: "كوميديا اجتماعية عن شاب ينتشر عبر مقاطعه القصيرة ويجد نفسه في قلب فضيحة رقمية.", contentType: "micro_drama", author: "أحمد المراغي", narrator: "ياسر الشريف", categorySlugs: ["cinema"], episodes: 8, minutes: 96, daysAgo: 10, isNew: true, isTrending: true },
  { title: "عصبة الشياطين", slug: "usbatalshayateen", description: "فانتازيا صوتية عن مجموعة من الشباب يكتشفون قوى خارقة في مدينة عربية قديمة.", contentType: "audio_drama", author: "سعود السنعوسي", narrator: "عمر الهاشمي", categorySlugs: ["fantasy"], episodes: 12, minutes: 385, daysAgo: 40 },
  { title: "بودكاست حكي مسموع", slug: "haki-masmoo3", description: "برنامج أسبوعي يناقش الكتب والمؤلفين وأحدث ما يصدر في العالم العربي، مع ضيوف من عالم النشر.", contentType: "podcast", author: "هالة عياد", narrator: "هالة عياد", categorySlugs: ["arabic-literature", "business"], episodes: 24, minutes: 1150, daysAgo: 3, isNew: true, isFeatured: true },
  { title: "قهوة الصباح", slug: "qahwat-alsabah", description: "بودكاست يومي قصير يبدأ يومك بفكرة، قصة، وكلمة جميلة قبل أن تفتح هاتفك.", contentType: "podcast", author: "مصطفى سعد", narrator: "مصطفى سعد", categorySlugs: ["health"], episodes: 40, minutes: 620, daysAgo: 1, isNew: true },
  { title: "مجلة ثقافات العدد 12", slug: "magazine-thaqafat-12", description: "عدد شهر يضم مقالات، حوارات، وتحقيقات من ثقافات العالم العربي بالصوت والصورة.", contentType: "magazine", author: "فريق تحرير ثقافات", narrator: "سلمى الأيوبي", publisher: "منشورات حكي", categorySlugs: ["history"], episodes: 6, minutes: 180, daysAgo: 7, isNew: true },
  { title: "مجلة السرد العدد 30", slug: "magazine-al-sard-30", description: "مجلة شهرية مخصصة للقصة القصيرة والسرد العربي الجديد.", contentType: "magazine", author: "فريق تحرير السرد", narrator: "خالد الجابري", publisher: "دار الساقي", categorySlugs: ["arabic-literature"], episodes: 5, minutes: 150, daysAgo: 20 },
  { title: "كيف تنمو عاداتك", slug: "kayfa-tanmu-adatik", description: "دليل عملي لبناء عادات يومية تساعدك على تحسين حياتك خطوة بخطوة.", contentType: "ebook", author: "منال الشريف", publisher: "منشورات حكي", categorySlugs: ["self-development"], minutes: 320, daysAgo: 35, isTrending: true },
  { title: "فن اللامبالاة", slug: "fan-allamabala", description: "كتاب إلكتروني عن اختيار ما يستحق انتباهك وترك ما لا يستحق، بأسلوب صريح ومباشر.", contentType: "ebook", author: "أحمد المراغي", publisher: "دار التنوير", categorySlugs: ["self-development", "business"], minutes: 280, daysAgo: 90 },
  { title: "التاريخ السري لصناعة العالم", slug: "tareekh-alam-alsirri", description: "رحلة عبر الحقب التاريخية وكيف صنع الأفراد العاديون أموراً غير عادية غيّرت مسار البشرية.", contentType: "ebook", author: "إبراهيم نصر الله", publisher: "دار الشروق", categorySlugs: ["history"], minutes: 540, daysAgo: 200, isFeatured: true },
  { title: "عقل الملياردير", slug: "aql-almilyarder", description: "كتاب عن عقلية ريادة الأعمال وكيف يفكر أصحاب المشاريع الكبيرة في الفرص والمخاطر.", contentType: "ebook", author: "سعود السنعوسي", publisher: "منشورات حكي", categorySlugs: ["business"], minutes: 360, daysAgo: 12, isNew: true },
  { title: "روائح القاهرة", slug: "rawaeh-alqahira", description: "رواية صوتية عن مدينة القاهرة كما لم ترها من قبل: من أزقتها الضيقة إلى شوارعها الكبرى.", contentType: "audiobook", author: "أحمد المراغي", narrator: "نورة الشامسي", publisher: "دار الشروق", categorySlugs: ["novels", "history"], episodes: 11, minutes: 465, daysAgo: 70, isTrending: true },
  { title: "قمر على الأسطح", slug: "qamar-ala-alasateh", description: "حكاية عن سطوح البيوت في البلد القديم حيث تجتمع الأحلام والذكريات كل مساء.", contentType: "audiobook", author: "إبراهيم نصر الله", narrator: "سلمى الأيوبي", publisher: "دار التنوير", categorySlugs: ["arabic-literature"], episodes: 9, minutes: 375, daysAgo: 150 },
  { title: "همسات النداء", slug: "hamsat-alnidwa", description: "دراما صوتية نفسية عن امرأة تتلقى مكالمات من مجهول يدّعي أنه يعرف سراً عن ماضيها.", contentType: "audio_drama", author: "ريم الكمالي", narrator: "هالة عياد", categorySlugs: ["novels", "cinema"], episodes: 8, minutes: 240, daysAgo: 18, isFeatured: true },
  { title: "شقة 404", slug: "shaqqa-404", description: "مايكرو دراما عن شقة غريبة تفتح أبوابها لساكنها الجديد كل ليلة على حكاية مختلفة.", contentType: "micro_drama", author: "ياسمين الخاتم", narrator: "ليان المطيري", categorySlugs: ["fantasy", "cinema"], episodes: 10, minutes: 110, daysAgo: 5, isNew: true, isTrending: true },
  { title: "لعبة العروش العربية", slug: "laabat-alurush", description: "فانتازيا صوتية ملحمية عن ممالك عربية خيالية تتنازع السلطة والحكمة.", contentType: "audio_drama", author: "سعود السنعوسي", narrator: "خالد الجابري", categorySlugs: ["fantasy"], episodes: 15, minutes: 520, daysAgo: 55 },
  { title: "البودكاست العكسي", slug: "bodcast-alaksi", description: "نقاشات ساخرة وغير مكتملة عن كل ما يحدث في عالم الثقافة والفن، بحضور ضيوف مفاجئين.", contentType: "podcast", author: "ياسر الشريف", narrator: "ياسر الشريف", categorySlugs: ["cinema", "business"], episodes: 18, minutes: 840, daysAgo: 4, isNew: true },
  { title: "حكايات ما أحلوها", slug: "hikayat-ma-ahlawha", description: "بودكاست قصصي يروي حكايات عالمية بلمسة عربية للأطفال والكبار معاً.", contentType: "podcast", author: "ليان المطيري", narrator: "ليان المطيري", categorySlugs: ["novels", "health"], episodes: 30, minutes: 750, daysAgo: 8 },
  { title: "مجلة معرفة العدد 5", slug: "magazine-marifa-5", description: "مجلة علمية شهرية تبسط أحدث الأبحاث في الطب والفضاء والتكنولوجيا.", contentType: "magazine", author: "فريق تحرير معرفة", narrator: "مصطفى سعد", publisher: "منشورات حكي", categorySlugs: ["science"], episodes: 4, minutes: 140, daysAgo: 14, isNew: true },
];

const PLANS = [
  {
    name: "مجاني",
    nameEn: "Free",
    description: "ابدأ رحلتك مع حكي بدون أي تكلفة",
    price: 0,
    currency: "SAR",
    period: "monthly" as const,
    features: [
      "اختيار محدود من الكتب الصوتية",
      "بودكاست مجاني",
      "مايكرو دراما محدودة",
      "إعلانات أثناء الاستماع",
    ],
    featuresEn: [
      "Limited audiobook selection",
      "Free podcasts",
      "Limited micro dramas",
      "Ads during playback",
    ],
    isPopular: false,
    order: 1,
  },
  {
    name: "باقة حكي",
    nameEn: "HAKI Plus",
    description: "التجربة الكاملة بلا حدود",
    price: 29,
    currency: "SAR",
    period: "monthly" as const,
    features: [
      "كل الكتب الصوتية والإلكترونية",
      "دراما صوتية ومايكرو دراما كاملة",
      "بدون إعلانات",
      "تحميل للاستماع دون اتصال",
      "بث مباشر حصري",
    ],
    featuresEn: [
      "All audiobooks & ebooks",
      "Full audio dramas & micro dramas",
      "Ad-free experience",
      "Offline downloads",
      "Exclusive live streams",
    ],
    isPopular: true,
    order: 2,
  },
  {
    name: "سنوي",
    nameEn: "Annual",
    description: "وفّر 40% مع الباقة السنوية",
    price: 249,
    currency: "SAR",
    period: "yearly" as const,
    features: [
      "كل مزايا باقة حكي",
      "توفير 40% عن الدفع الشهري",
      "محتوى حصري للأعضاء السنويين",
      "دعم أولوية",
    ],
    featuresEn: [
      "All HAKI Plus benefits",
      "Save 40% vs monthly",
      "Exclusive member content",
      "Priority support",
    ],
    isPopular: false,
    order: 3,
  },
];

const CHALLENGES = [
  {
    name: "تحدي الـ 30 يوم",
    nameEn: "30-Day Challenge",
    description: "استمع إلى كتاب صوتي واحد على الأقل يومياً لمدة 30 يوماً وأكمل التحدي.",
    daysFromNow: -5,
    durationDays: 35,
    reward: "شهر مجاني من باقة حكي",
    baseParticipants: 1240,
  },
  {
    name: "أسبوع الرواية العربية",
    nameEn: "Arabic Novel Week",
    description: "أنهِ رواية عربية كاملة خلال أسبوع واحد وشارك انطباعك مع المجتمع.",
    daysFromNow: 3,
    durationDays: 7,
    reward: "كتاب صوتي مجاني",
    baseParticipants: 412,
  },
  {
    name: "ماراثون البودكاست",
    nameEn: "Podcast Marathon",
    description: "استمع إلى 10 حلقات بودكاست من مختلف البرامج خلال أسبوعين.",
    daysFromNow: -30,
    durationDays: 20,
    reward: "وسام مستمع النهائي",
    baseParticipants: 890,
  },
  {
    name: "نادي الكتاب الإلكتروني",
    nameEn: "Ebook Club",
    description: "اقرأ 3 كتب إلكترونية خلال الشهر وانضم لجلسات النقاش الأسبوعية.",
    daysFromNow: 10,
    durationDays: 30,
    reward: "خصم 50% على الاشتراك السنوي",
    baseParticipants: 256,
  },
];

const SETTINGS: Array<{ key: string; value: string }> = [
  { key: "site_name_ar", value: "حكي" },
  { key: "site_name_en", value: "HAKI" },
  { key: "whatsapp_number", value: "966500000000" },
  { key: "contact_email", value: "hello@haki.example" },
  { key: "hero_title", value: "اقرأ، استمع\nوعش المحتوى\nمع حكي" },
  { key: "hero_subtitle", value: "كتب صوتية، دراما، بودكاست، مجلات، وبث مباشر — كل ما تحب في مكان واحد." },
];

const STREAMS = [
  {
    title: "مساء حكي — الحلقة الأسبوعية",
    hostName: "عمر الهاشمي",
    description: "ناقش معنا أفضل ما سمعته هذا الأسبوع، مع ضيوف مفاجئين واختيارات خاصة.",
    isLive: true,
    listeners: 1834,
    scheduledStart: "20:00",
    scheduledEnd: "22:00",
  },
  {
    title: "بث مباشر: قراءات مسائية",
    hostName: "سلمى الأيوبي",
    description: "قراءة مسائية هادئة من رواية مختارة مع نقاش مفتوح مع المستمعين.",
    isLive: false,
    listeners: 0,
    scheduledStart: "21:00",
    scheduledEnd: "23:00",
  },
];

const PROGRAM_SCHEDULE = [
  { day: "السبت", name: "قهوة الصباح", host: "مصطفى سعد", start: "08:00", end: "09:00" },
  { day: "الأحد", name: "حكي مسموع", host: "هالة عياد", start: "18:00", end: "19:30" },
  { day: "الاثنين", name: "مساء حكي", host: "عمر الهاشمي", start: "20:00", end: "22:00" },
  { day: "الثلاثاء", name: "سر الفراشة — دراما", host: "نورة الشامسي", start: "21:00", end: "22:00" },
  { day: "الأربعاء", name: "البودكاست العكسي", host: "ياسر الشريف", start: "19:00", end: "20:30" },
  { day: "الخميس", name: "حكايات ما أحلوها", host: "ليان المطيري", start: "17:00", end: "18:00" },
  { day: "الجمعة", name: "قراءات مسائية", host: "سلمى الأيوبي", start: "21:00", end: "23:00" },
];

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const seedAll = mutation({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireSeedAccess(ctx);

    const existingContent = await ctx.db.query("content").first();
    if (existingContent && !args.force) {
      return { skipped: true, message: "Content already exists. Use force: true to reseed." };
    }
    if (existingContent && args.force) {
      // wipe content-related tables
      for (const table of [
        "content",
        "chapters",
        "episodes",
        "content_categories",
        "subscription_plans",
        "challenges",
        "live_streams",
        "settings",
      ] as const) {
        const rows = await ctx.db.query(table).collect();
        for (const row of rows) await ctx.db.delete(row._id);
      }
    }

    // ---- Authors ----
    const authorIds = new Map<string, Id<"authors">>();
    for (const a of AUTHORS) {
      const existing = await ctx.db
        .query("authors")
        .filter((q) => q.eq(q.field("name"), a.name))
        .first();
      if (existing) {
        authorIds.set(a.name, existing._id);
        continue;
      }
      const id = await ctx.db.insert("authors", {
        name: a.name,
        nameEn: a.nameEn,
        bio: `كاتب ومؤلف يُعد ${a.name} من الأسماء البارزة في المشهد الثقافي العربي المعاصر.`,
      });
      authorIds.set(a.name, id);
    }

    // ---- Narrators ----
    const narratorIds = new Map<string, Id<"narrators">>();
    for (const n of NARRATORS) {
      const existing = await ctx.db
        .query("narrators")
        .filter((q) => q.eq(q.field("name"), n.name))
        .first();
      if (existing) {
        narratorIds.set(n.name, existing._id);
        continue;
      }
      const id = await ctx.db.insert("narrators", {
        name: n.name,
        nameEn: n.nameEn,
        bio: `راوٍ صوتي معروف بأسلوب أداء ساحر يمنح النص حياة جديدة.`,
      });
      narratorIds.set(n.name, id);
    }

    // ---- Publishers ----
    const publisherIds = new Map<string, Id<"publishers">>();
    for (const p of PUBLISHERS) {
      const existing = await ctx.db
        .query("publishers")
        .filter((q) => q.eq(q.field("name"), p.name))
        .first();
      if (existing) {
        publisherIds.set(p.name, existing._id);
        continue;
      }
      const id = await ctx.db.insert("publishers", {
        name: p.name,
        nameEn: p.nameEn,
        bio: `${p.name} — دار نشر عربية تُصدر أفضل ما في الأدب والفكر.`,
      });
      publisherIds.set(p.name, id);
    }

    // ---- Categories ----
    const categoryIds = new Map<string, Id<"categories">>();
    for (const c of CATEGORIES) {
      const existing = await ctx.db
        .query("categories")
        .withIndex("by_slug", (q: any) => q.eq("slug", c.slug))
        .first();
      if (existing) {
        categoryIds.set(c.slug, existing._id);
        continue;
      }
      const id = await ctx.db.insert("categories", {
        name: c.name,
        nameEn: c.nameEn,
        slug: c.slug,
      });
      categoryIds.set(c.slug, id);
    }

    // ---- Content ----
    const now = Date.now();
    let created = 0;
    for (const c of CONTENTS) {
      const h = hash(c.slug);
      const paletteIdx = h % 6;
      const coverImage = makeCoverDataUri(c.title, paletteIdx);
      const authorId = authorIds.get(c.author);
      const narratorId = c.narrator ? narratorIds.get(c.narrator) : undefined;
      const publisherId = c.publisher ? publisherIds.get(c.publisher) : undefined;

      const contentId = await ctx.db.insert("content", {
        title: c.title,
        slug: c.slug,
        description: c.description,
        coverImage,
        contentType: c.contentType,
        authorId,
        narratorId,
        publisherId,
        duration: c.minutes * 60,
        releaseDate: new Date(now - c.daysAgo * 86400000).toISOString().slice(0, 10),
        status: "published",
        isFeatured: Boolean(c.isFeatured),
        isTrending: Boolean(c.isTrending),
        isNew: Boolean(c.isNew),
        playCount: 500 + (h % 90000),
        audioUrl: undefined,
        createdAt: now - c.daysAgo * 86400000,
        updatedAt: now,
      });

      // link categories
      for (const slug of c.categorySlugs) {
        const catId = categoryIds.get(slug);
        if (catId) {
          await ctx.db.insert("content_categories", {
            contentId,
            categoryId: catId,
          });
        }
      }

      // chapters for audiobooks & ebooks
      if (c.contentType === "audiobook" || c.contentType === "ebook") {
        const chapterCount = c.episodes ?? 6;
        for (let i = 1; i <= chapterCount; i++) {
          await ctx.db.insert("chapters", {
            contentId,
            number: i,
            title: `الفصل ${i}`,
            audioUrl: undefined,
            duration: Math.round((c.minutes * 60) / chapterCount),
          });
        }
      }

      // episodes for drama/podcast/magazine/micro_drama
      if (["audio_drama", "podcast", "magazine", "micro_drama"].includes(c.contentType)) {
        const epCount = c.episodes ?? 5;
        for (let i = 1; i <= epCount; i++) {
          await ctx.db.insert("episodes", {
            contentId,
            number: i,
            title:
              c.contentType === "podcast"
                ? `الحلقة ${i}`
                : c.contentType === "magazine"
                  ? `العدد ${i}`
                  : `الحلقة ${i}`,
            description: `حلقة ${i} من ${c.title}.`,
            audioUrl: undefined,
            duration: Math.round((c.minutes * 60) / epCount),
            coverImage,
            publishDate: new Date(now - (c.daysAgo + (epCount - i) * 7) * 86400000)
              .toISOString()
              .slice(0, 10),
          });
        }
      }
      created++;
    }

    // ---- Subscription plans ----
    for (const p of PLANS) {
      await ctx.db.insert("subscription_plans", {
        name: p.name,
        nameEn: p.nameEn,
        description: p.description,
        price: p.price,
        currency: p.currency,
        period: p.period,
        features: p.features,
        featuresEn: p.featuresEn,
        isPopular: p.isPopular,
        isActive: true,
        order: p.order,
      });
    }

    // ---- Challenges ----
    for (const ch of CHALLENGES) {
      const start = new Date(now + ch.daysFromNow * 86400000);
      const end = new Date(start.getTime() + ch.durationDays * 86400000);
      const today = new Date();
      const status =
        start > today ? "upcoming" : end > today ? "active" : "ended";
      await ctx.db.insert("challenges", {
        name: ch.name,
        nameEn: ch.nameEn,
        description: ch.description,
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
        participants: ch.baseParticipants,
        reward: ch.reward,
        status,
        isActive: status !== "ended",
      });
    }

    // ---- Live streams ----
    for (const s of STREAMS) {
      await ctx.db.insert("live_streams", {
        title: s.title,
        hostName: s.hostName,
        description: s.description,
        streamUrl: undefined,
        scheduledStart: s.scheduledStart,
        scheduledEnd: s.scheduledEnd,
        isLive: s.isLive,
        listeners: s.listeners,
      });
    }

    // ---- Settings ----
    for (const s of SETTINGS) {
      await ctx.db.insert("settings", { key: s.key, value: s.value });
    }

    return { ok: true, created };
  },
});

function makeCoverDataUri(title: string, paletteIdx: number) {
  // SVG data-uri placeholder cover; easy to replace with real images later.
  const palettes = [
    ["#F97316", "#EA580C"],
    ["#EA580C", "#9A3412"],
    ["#111111", "#EA580C"],
    ["#C2410C", "#FDBA74"],
    ["#7C2D12", "#F97316"],
    ["#292524", "#F59E0B"],
  ];
  const [c1, c2] = palettes[paletteIdx % palettes.length];
  const letter = encodeURIComponent(title.trim().charAt(0));
  const safeTitle = encodeURIComponent(title);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='560'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/></linearGradient></defs><rect width='400' height='560' fill='url(#g)'/><circle cx='340' cy='80' r='110' fill='rgba(255,255,255,0.08)'/><circle cx='40' cy='500' r='140' fill='rgba(0,0,0,0.10)'/><text x='200' y='250' font-size='120' text-anchor='middle' fill='rgba(255,255,255,0.92)' font-family='serif'>${letter}</text><text x='200' y='330' font-size='26' text-anchor='middle' fill='rgba(255,255,255,0.85)' font-family='sans-serif'>${safeTitle}</text></svg>`;
  return `data:image/svg+xml,${svg}`;
}
