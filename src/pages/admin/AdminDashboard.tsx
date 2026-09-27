import { api } from "@/convex/_generated/api";
import { FileUpload } from "@/components/FileUpload";
import { RequireAuth } from "@/components/RequireAuth";
import { AdminGate } from "@/components/AdminGate";
import { TracksManager } from "@/pages/admin/TracksManager";
import { HomepageManager } from "@/pages/admin/HomepageManager";
import { MediaLibrary } from "@/pages/admin/MediaLibrary";
import { NotificationsManager } from "@/pages/admin/NotificationsManager";
import { PaymentMethodsManager } from "@/pages/admin/PaymentMethodsManager";
import { ManualPaymentsManager } from "@/pages/admin/ManualPaymentsManager";
import { RoyaltiesManager } from "@/pages/admin/RoyaltiesManager";
import { BookImporterManager } from "@/pages/admin/BookImporterManager";
import { SEO } from "@/components/SEO";
import { HakiLogo } from "@/components/HakiLogo";
import { LOGO_COVER } from "@/lib/logoAsset";
import { ContentTypeIcon } from "@/components/ContentCard";
import { TYPE_LABELS } from "@/components/ContentCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowLeft,
  AudioLines,
  CirclePlus,
  BarChart3,
  BookOpen,
  Building2,
  Crown,
  FileText,
  Flame,
  Globe,
  Headphones,
  Images,
  LayoutDashboard,
  Loader2,
  ListMusic,
  ClipboardList,
  LogOut,
  Menu,
  Mic,
  Newspaper,
  PenLine,
  Pencil,
  Podcast,
  Plus,
  Radio,
  Settings2,
  Package,
  Bell,
  Wallet,
  Coins,
  Shield,
  Sparkles,
  Star,
  Tags,
  Theater,
  Trash2,
  Trophy,
  Upload,
  Users,
  KeyRound,
  RefreshCw,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

type TabKey =
  | "overview"
  | "addContent"
  | "allContent"
  | "homepage"
  | "entities"
  | "audiobooks"
  | "ebooks"
  | "drama"
  | "microdrama"
  | "podcasts"
  | "magazines"
  | "featured"
  | "tracks"
  | "media"
  | "live"
  | "submissions"
  | "notifications"
  | "paymentMethods"
  | "manualPayments"
  | "authors"
  | "narrators"
  | "publishers"
  | "categories"
  | "plans"
  | "royalties"
  | "challenges"
  | "users"
  | "access"
  | "bookImporter"
  | "settings";

function AdminInner() {
  const { lang } = useLang();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("overview");
  const [mobileNav, setMobileNav] = useState(false);

  const L = (ar: string, en: string) => (lang === "ar" ? ar : en);

  // Sidebar groups — matching the approved admin IA:
  // أساسي / المحتوى / إدارة المحتوى / التفاعلات والأنشطة / الإعدادات
  const navGroups: {
    label?: string;
    items: { key: TabKey; label: string; icon: any }[];
  }[] = [
    {
      label: L("الأساسي", "Core"),
      items: [
        { key: "overview", label: L("نظرة التحكم", "Dashboard"), icon: BarChart3 },
        { key: "addContent", label: L("إضافة محتوى", "Add content"), icon: CirclePlus },
        { key: "homepage", label: L("عرض الرئيسية", "Homepage"), icon: LayoutDashboard },
        { key: "entities", label: L("هيكل المنصة", "Platform structure"), icon: Building2 },
      ],
    },
    {
      label: L("المحتوى", "Content"),
      items: [
        { key: "allContent", label: L("كل المحتوى", "All content"), icon: Package },
        { key: "audiobooks", label: L("كتب صوتية", "Audiobooks"), icon: Trash2 },
        { key: "ebooks", label: L("كتب إلكترونية", "E-books"), icon: BookOpen },
        { key: "podcasts", label: L("بودكاست", "Podcasts"), icon: Podcast },
        { key: "drama", label: L("دراما صوتية", "Audio drama"), icon: Theater },
        { key: "microdrama", label: L("مايكرو دراما", "Micro drama"), icon: Mic },
        { key: "magazines", label: L("مجلات", "Magazines"), icon: Newspaper },
      ],
    },
    {
      label: L("إدارة المحتوى", "Content ops"),
      items: [
        { key: "featured", label: L("المميز", "Featured"), icon: Star },
        { key: "tracks", label: L("الفصول والحلقات", "Chapters & episodes"), icon: ListMusic },
        { key: "media", label: L("الوسائط", "Media"), icon: Images },
        { key: "live", label: L("البث المباشر", "Live streaming"), icon: Radio },
        { key: "submissions", label: L("طلبات النشر", "Submissions"), icon: FileText },
        { key: "notifications", label: L("الإشعارات", "Notifications"), icon: Bell },
        { key: "users", label: L("المستخدمون", "Users"), icon: Users },
        { key: "access", label: L("الوصول والأدوار", "Access & roles"), icon: KeyRound },
      ],
    },
    {
      label: L("المكتبة", "Library"),
      items: [{ key: "bookImporter", label: L("مستورد الكتب", "Book Importer"), icon: BookOpen }],
    },
    {
      label: L("التفاعلات والأنشطة", "Engagement"),
      items: [
        { key: "plans", label: L("الاشتراكات", "Subscriptions"), icon: Crown },
        { key: "paymentMethods", label: L("وسائل الدفع", "Payment methods"), icon: Wallet },
        { key: "manualPayments", label: L("طلبات الدفع اليدوي", "Manual payments"), icon: ClipboardList },
        { key: "royalties", label: L("توزيع الأرباح", "Revenue distribution"), icon: Coins },
        { key: "challenges", label: L("التحديات", "Challenges"), icon: Trophy },
      ],
    },
    {
      label: L("الإعدادات", "Settings"),
      items: [{ key: "settings", label: L("الإعدادات", "Settings"), icon: Settings2 }],
    },
  ];



  const sidebarNav = (
    <nav className="flex flex-col gap-5">
      {navGroups.map((g, gi) => (
        <div key={gi}>
          {g.label && (
            <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground/70">
              {g.label}
            </p>
          )}
          <div className="space-y-0.5">
            {g.items.map((tb) => (
              <button
                key={tb.key}
                type="button"
                onClick={() => setTab(tb.key)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                  tab === tb.key
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <tb.icon className="size-4" />
                {tb.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-secondary/40">
      <SEO title={`${L("لوحة الإدارة", "Admin")} | حكي`} />

      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 border-b bg-background lg:hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <HakiLogo variant="outline" size={32} hideWordmark className="text-foreground" />
            <span className="font-logo text-base font-black">حكي Admin</span>
          </div>
          <Sheet open={mobileNav} onOpenChange={setMobileNav}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="القائمة">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="text-start">{L("لوحة التحكم", "Dashboard")}</SheetTitle>
              </SheetHeader>
              <div
                className="px-4 pb-6"
                onClick={() => setMobileNav(false)}
              >
                {sidebarNav}
                <div className="mt-6 space-y-2 border-t pt-4">
                  <Link to="/" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted">
                    <Globe className="size-4" />
                    {L("الموقع", "Site")}
                  </Link>
                  <button
                    type="button"
                    onClick={async () => { await signOut(); navigate("/"); }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="size-4" />
                    {L("خروج", "Sign out")}
                  </button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1440px]">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto border-e bg-background lg:flex">
          <div className="flex items-center gap-2.5 px-4 py-4">
            <HakiLogo variant="outline" size={36} hideWordmark className="text-foreground" />
            <div>
              <p className="font-logo text-base font-black leading-tight">حكي Admin</p>
              <p className="truncate text-[11px] text-muted-foreground" dir="ltr">{user?.email}</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-4">{sidebarNav}</div>
          <div className="space-y-1 border-t px-2 py-3">
            <Link to="/" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted">
              <Globe className="size-4" />
              {L("الموقع", "Site")}
            </Link>
            <button
              type="button"
              onClick={async () => { await signOut(); navigate("/"); }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10"
            >
              <LogOut className="size-4" />
              {L("خروج", "Sign out")}
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          {tab === "overview" && <Overview lang={lang} L={L} go={setTab} />}
          {tab === "addContent" && <ContentManager key="add" L={L} lang={lang} defaultType="audiobook" autoOpen />}
          {tab === "allContent" && <ContentManager key="all" L={L} lang={lang} defaultType="all" />}
          {tab === "homepage" && <HomepageManager L={L} />}
          {tab === "entities" && <EntityManager key="entities" L={L} />}
          {tab === "audiobooks" && <ContentManager key="audiobooks" L={L} lang={lang} defaultType="audiobook" />}
          {tab === "ebooks" && <ContentManager key="ebooks" L={L} lang={lang} defaultType="ebook" />}
          {tab === "drama" && <ContentManager key="drama" L={L} lang={lang} defaultType="audio_drama" />}
          {tab === "microdrama" && <ContentManager key="microdrama" L={L} lang={lang} defaultType="micro_drama" />}
          {tab === "podcasts" && <ContentManager key="podcasts" L={L} lang={lang} defaultType="podcast" />}
          {tab === "magazines" && <ContentManager key="magazines" L={L} lang={lang} defaultType="magazine" />}
          {tab === "featured" && <ContentManager key="featured" L={L} lang={lang} featuredOnly />}
          {tab === "tracks" && <TracksManager L={L} />}
          {tab === "media" && <MediaLibrary L={L} />}
          {tab === "plans" && <PlansManager L={L} lang={lang} />}
          {tab === "challenges" && <ChallengesManager L={L} />}
          {tab === "live" && <LiveManager L={L} />}
          {tab === "submissions" && <SubmissionsManager L={L} />}
          {tab === "notifications" && <NotificationsManager L={L} />}
          {tab === "paymentMethods" && <PaymentMethodsManager L={L} />}
          {tab === "manualPayments" && <ManualPaymentsManager L={L} />}
          {tab === "royalties" && <RoyaltiesManager L={L} />}
          {tab === "bookImporter" && <BookImporterManager L={L} />}
          {tab === "users" && <UsersManager L={L} />}
          {tab === "access" && <AccessManager L={L} />}
          {tab === "settings" && <SettingsManager L={L} />}
        </main>
      </div>
    </div>
  );
}


// ============ Overview ============

function Overview({
  lang,
  L,
  go,
}: {
  lang: string;
  L: (ar: string, en: string) => string;
  go: (t: TabKey) => void;
}) {
  const stats = useQuery(api.admin.stats, {});
  const n = (v: number | undefined) =>
    v === undefined ? "…" : v.toLocaleString(lang === "ar" ? "ar" : "en");

  const cards = [
    { label: L("المستخدمون", "Users"), value: stats?.users, icon: Users },
    { label: L("المشتركون", "Subscribers"), value: stats?.subscribers, icon: Crown, accent: true },
    { label: L("المحتويات", "Content"), value: stats?.content, icon: Headphones },
    { label: L("طبقات النشر", "Publishing layers"), value: stats?.publishingEntities, icon: Building2 },
  ];

  const quick = [
    { tab: "addContent" as TabKey, label: L("المحتوى", "Content"), desc: L("إضافة المحتوى والتعديل", "Add & edit content"), icon: CirclePlus },
    { tab: "challenges" as TabKey, label: L("التفاعلات والأنشطة", "Engagement"), desc: L("بث مباشر وتحديات", "Live & challenges"), icon: Trophy },
    { tab: "users" as TabKey, label: L("المستخدمون", "Users"), desc: L("إدارة المستخدمين", "Manage users"), icon: Users },
    { tab: "entities" as TabKey, label: L("طبقات النشر", "Publishing layers"), desc: L("مؤلف، دار نشر، راوي", "Author, publisher, narrator"), icon: Building2 },
    { tab: "submissions" as TabKey, label: L("طلبات النشر", "Submissions"), desc: L("متابعة الطلبات", "Track requests"), icon: FileText },
  ];

  const typeLabel: Record<string, string> = {
    audiobook: "audiobook",
    ebook: "ebook",
    podcast: "podcast",
    audio_drama: "drama",
    micro_drama: "micro",
    magazine: "magazine",
    live: "live",
  };

  return (
    <div>
      <h1 className="text-2xl font-black">{L("لوحة التحكم", "Dashboard")}</h1>

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className={cn(
              "rounded-2xl border bg-card p-5 text-center card-shadow",
              c.accent && "border-primary/40",
            )}
          >
            <p className={cn("text-2xl font-black tabular-nums", c.accent && "text-primary")}>
              {n(c.value)}
            </p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Welcome + quick access */}
      <section className="mt-8 rounded-3xl border bg-card p-6 card-shadow">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black">{L("مرحبًا، مدير حكي 👋", "Welcome, HAKI admin 👋")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {L("إدارة منصة حكي من مكان واحد", "Manage the whole HAKI platform from one place")}
            </p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {quick.map((q) => (
            <button
              key={q.tab}
              type="button"
              onClick={() => go(q.tab)}
              className="group flex flex-col items-center gap-2 rounded-2xl border bg-secondary/50 p-4 text-center transition-all hover:card-shadow-hover"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-background transition-transform group-hover:scale-110">
                <q.icon className="size-5 text-primary" />
              </span>
              <span className="text-sm font-extrabold">{q.label}</span>
              <span className="text-[11px] leading-tight text-muted-foreground">{q.desc}</span>
            </button>
          ))}
          <Link
            to="/"
            className="group flex flex-col items-center gap-2 rounded-2xl border bg-secondary/50 p-4 text-center transition-all hover:card-shadow-hover"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-background transition-transform group-hover:scale-110">
              <Globe className="size-5 text-primary" />
            </span>
            <span className="text-sm font-extrabold">{L("عرض الموقع", "View site")}</span>
            <span className="text-[11px] leading-tight text-muted-foreground">
              {L("زيارة الموقع", "Visit the platform")}
            </span>
          </Link>
        </div>
      </section>

      {/* Latest content */}
      <section className="mt-8 rounded-3xl border bg-card p-6 card-shadow">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black">{L("آخر المحتوى", "Latest content")}</h2>
          <button
            type="button"
            onClick={() => go("addContent")}
            className="text-sm font-bold text-primary hover:underline"
          >
            {L("إضافة محتوى", "Add content")}
          </button>
        </div>
        {stats === undefined ? (
          <div className="mt-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        ) : (stats.recentContent ?? []).length === 0 ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {L("لا يوجد محتوى بعد", "No content yet")}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b text-start text-xs text-muted-foreground">
                  <th className="p-3 text-start font-semibold">#</th>
                  <th className="p-3 text-start font-semibold">{L("العنوان", "Title")}</th>
                  <th className="p-3 text-start font-semibold">{L("المؤلف", "Author")}</th>
                  <th className="p-3 text-start font-semibold">{L("النوع", "Type")}</th>
                  <th className="p-3 text-start font-semibold">{L("التاريخ", "Date")}</th>
                </tr>
              </thead>
              <tbody>
                {(stats.recentContent ?? []).map((row: any, i: number) => (
                  <tr key={row._id} className="border-b last:border-0">
                    <td className="p-3 tabular-nums text-muted-foreground">{i + 1}</td>
                    <td className="max-w-[260px] truncate p-3 font-semibold">{row.title}</td>
                    <td className="p-3 text-muted-foreground">{row.authorName || "—"}</td>
                    <td className="p-3">
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
                        {typeLabel[row.contentType] ?? row.contentType}
                      </span>
                    </td>
                    <td className="p-3 tabular-nums text-muted-foreground" dir="ltr">
                      {new Date(row.createdAt).toISOString().slice(0, 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export function SeedPanel({ L }: { L: (ar: string, en: string) => string }) {
  const seed = useMutation(api.seed.seedAll);
  const [loading, setLoading] = useState(false);
  const handleSeed = async (force: boolean) => {
    setLoading(true);
    try {
      const res = await seed({ force });
      if (res.skipped) {
        toast.info(L("البيانات موجودة بالفعل", "Data already exists"));
      } else {
        toast.success(L(`تمت إضافة ${res.created} عنصر محتوى`, `Created ${res.created} items`));
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="mt-10 rounded-2xl border bg-card p-6 card-shadow">
      <h3 className="flex items-center gap-2 font-extrabold">
        <Upload className="size-4 text-primary" />
        {L("بيانات تجريبية", "Demo data")}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {L(
          "املأ المنصة ببيانات عربية واقعية (24 عنصر محتوى، باقات، تحديات، بث مباشر).",
          "Populate the platform with realistic Arabic demo data (24 content items, plans, challenges, live streams).",
        )}
      </p>
      <div className="mt-4 flex gap-2">
        <Button onClick={() => handleSeed(false)} disabled={loading} className="font-bold">
          {loading && <Loader2 className="size-4 animate-spin" />}
          {L("تعبئة البيانات", "Seed data")}
        </Button>
        <Button variant="outline" onClick={() => handleSeed(true)} disabled={loading}>
          {L("إعادة التعبئة (استبدال)", "Reseed (replace)")}
        </Button>
      </div>
    </div>
  );
}

// ============ Content manager ============

function ContentManager({ L, lang, defaultType, featuredOnly, autoOpen }: { L: (ar: string, en: string) => string; lang: string; defaultType?: string; featuredOnly?: boolean; autoOpen?: boolean }) {
  const items = useQuery(api.content.listAllForAdmin, {});
  const categories = useQuery(api.content.listCategories, {});
  const authors = useQuery(api.content.listAuthors, {});
  const narrators = useQuery(api.content.listNarrators, {});
  const publishers = useQuery(api.content.listPublishers, {});
  const upsert = useMutation(api.adminContent.upsertContent);
  const remove = useMutation(api.adminContent.deleteContent);
  const saveCoverUpload = useMutation(api.files.saveCover);
  const saveAudioUpload = useMutation(api.files.saveAudio);
  const saveFileUpload = useMutation(api.homepage.saveContentFile);
  const setFlags = useMutation(api.homepage.setFlags);
  const [typeFilter, setTypeFilter] = useState<string>(defaultType ?? "all");
  const [editing, setEditing] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Live preview values derived from the editing form state.
  const previewCover = editing?.coverImage ?? "";
  const previewTitle = editing?.title ?? "";

  // "Add content" tab: open the editor immediately on mount.
  useEffect(() => {
    if (autoOpen && !editing) {
      setEditing({
        title: "",
        slug: "",
        description: "",
        contentType: defaultType ?? "audiobook",
        authorId: "",
        narratorId: "",
        publisherId: "",
        coverImage: "",
        audioUrl: "",
        status: "published",
        isFeatured: false,
        isTrending: false,
        isNew: true,
        categoryIds: [],
      });
      setOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen]);

  const empty = {
    title: "",
    slug: "",
    description: "",
    contentType: defaultType ?? "audiobook",
    authorId: "",
    narratorId: "",
    publisherId: "",
    coverImage: "",
    audioUrl: "",
    status: "published",
    isFeatured: false,
    isTrending: false,
    isNew: true,
    categoryIds: [] as string[],
  };

  const startEdit = (item: any) => {
    setEditing({
      _id: item._id,
      title: item.title,
      slug: item.slug,
      description: item.description,
      fileUrl: item.fileUrl ?? "",
      contentType: item.contentType,
      authorId: item.authorId ?? "",
      narratorId: item.narratorId ?? "",
      publisherId: item.publisherId ?? "",
      coverImage: item.coverImage ?? "",
      audioUrl: item.audioUrl ?? "",
      status: item.status,
      isFeatured: item.isFeatured,
      isTrending: item.isTrending,
      isNew: item.isNew,
      categoryIds: item.categories?.map((c: any) => c.id) ?? [],
    });
    setOpen(true);
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const categoryIds = (editing?.categoryIds ?? []) as any[];
    try {
      await upsert({
        id: editing?._id,
        title: String(form.get("title")),
        slug: String(form.get("slug")),
        description: String(form.get("description")),
        contentType: String(form.get("contentType")) as any,
        authorId: (form.get("authorId") as string) ? (form.get("authorId") as any) : undefined,
        narratorId: (form.get("narratorId") as string) ? (form.get("narratorId") as any) : undefined,
        publisherId: (form.get("publisherId") as string) ? (form.get("publisherId") as any) : undefined,
        coverImage: String(form.get("coverImage") ?? "") || undefined,
        audioUrl: String(form.get("audioUrl") ?? "") || undefined,
        duration: Number(form.get("duration") ?? 0) * 60,
        status: String(form.get("status")) as any,
        isFeatured: form.get("isFeatured") === "on",
        isTrending: form.get("isTrending") === "on",
        isNew: form.get("isNew") === "on",
        categoryIds,
      });
      toast.success(L("تم الحفظ", "Saved"));
      setOpen(false);
      setEditing(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const visible = (items ?? [])
    .filter((i) => typeFilter === "all" || i.contentType === typeFilter)
    .filter((i) => (featuredOnly ? i.isFeatured : true));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black">{L("إدارة المحتوى", "Content management")}</h2>
        <Button
          className="font-bold"
          onClick={() => {
            setEditing({ ...empty });
            setOpen(true);
          }}
        >
          <Plus className="size-4" />
          {L("إضافة محتوى", "Add content")}
        </Button>
      </div>

      {/* Type filter pills */}
      <div className="no-scrollbar mt-4 flex gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setTypeFilter("all")}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
            typeFilter === "all" ? "border-primary bg-primary text-white" : "hover:bg-muted",
          )}
        >
          {L("الكل", "All")}
        </button>
        {Object.entries(TYPE_LABELS).map(([k, v]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTypeFilter(k)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
              typeFilter === k ? "border-primary bg-primary text-white" : "hover:bg-muted",
            )}
          >
            {v[lang as "ar" | "en"]}
          </button>
        ))}
      </div>

      {items === undefined ? (
        <Skeleton className="mt-6 h-64 rounded-2xl" />
      ) : visible.length === 0 ? (
        <div className="mt-6 rounded-2xl border bg-card p-10 text-center">
          <Headphones className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-3 font-bold">
            {featuredOnly
              ? L("لا يوجد محتوى مميز بعد", "No featured content yet")
              : L("لا يوجد محتوى في هذا القسم بعد", "No content in this section yet")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {L("أضف أول عنصر بزر «إضافة محتوى» أعلاه.", "Add your first item with the button above.")}
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border bg-card">
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>{L("العنوان", "Title")}</TH>
                  <TH>{L("الحالة", "Status")}</TH>
                  <TH>{L("إجراءات سريعة", "Quick actions")}</TH>
                  <TH>{" "}</TH>
                </TR>
              </THead>
              <TBody>
                {visible
                  .map((item) => (
                  <TR key={item._id}>
                    <TD>
                      <div className="flex items-center gap-2.5">
                        <img src={item.coverImage || LOGO_COVER} alt="" className="size-9 rounded-md object-cover" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">{item.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {TYPE_LABELS[item.contentType as keyof typeof TYPE_LABELS]?.[lang as "ar" | "en"] ?? item.contentType}
                            {item.authorName ? ` · ${item.authorName}` : ""}
                          </p>
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <Badge
                        variant="secondary"
                        className={cn(
                          item.status === "published" && "bg-green-100 text-green-700",
                          item.status === "draft" && "bg-amber-100 text-amber-700",
                        )}
                      >
                        {item.status === "published" ? L("منشور", "Published") : L("مسودة", "Draft")}
                      </Badge>
                    </TD>
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        <Button
                          variant={item.status === "published" ? "secondary" : "default"}
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={async () => {
                            await setFlags({
                              contentId: item._id,
                              status: item.status === "published" ? "draft" : "published",
                            });
                            toast.success(item.status === "published" ? L("أُخفي (مسودة)", "Unpublished") : L("تم النشر", "Published"));
                          }}
                        >
                          {item.status === "published" ? L("إلغاء النشر", "Unpublish") : L("نشر", "Publish")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn("size-7", item.isFeatured && "text-primary")}
                          aria-label={L("مميز", "Featured")}
                          title={L("مميز (Featured)", "Featured")}
                          onClick={async () => {
                            await setFlags({ contentId: item._id, isFeatured: !item.isFeatured });
                          }}
                        >
                          <Star className={cn("size-4", item.isFeatured && "fill-current")} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn("size-7", item.isTrending && "text-primary")}
                          aria-label={L("رائج", "Trending")}
                          title={L("رائج (Trending)", "Trending")}
                          onClick={async () => {
                            await setFlags({ contentId: item._id, isTrending: !item.isTrending });
                          }}
                        >
                          <Flame className={cn("size-4", item.isTrending && "fill-current")} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn("size-7", item.isNew && "text-primary")}
                          aria-label={L("جديد", "New")}
                          title={L("جديد (New)", "New")}
                          onClick={async () => {
                            await setFlags({ contentId: item._id, isNew: !item.isNew });
                          }}
                        >
                          <Sparkles className={cn("size-4", item.isNew && "fill-current")} />
                        </Button>
                      </div>
                    </TD>
                    <TD>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => startEdit(item)} aria-label={L("تعديل", "Edit")}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={L("حذف", "Delete")}
                          onClick={async () => {
                            if (!confirm(L("تأكيد الحذف؟", "Confirm delete?"))) return;
                            await remove({ id: item._id });
                            toast.success(L("تم الحذف", "Deleted"));
                          }}
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </div>
      )}

      {/* Editor dialog (simple fixed panel) */}
      {open && editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <form
            onSubmit={handleSave}
            className="my-8 grid w-full max-w-3xl gap-5 rounded-3xl border bg-background p-6 lg:grid-cols-[1fr_220px]"
          >
            <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black">
                {editing._id ? L("تعديل محتوى", "Edit content") : L("إضافة محتوى", "Add content")}
              </h3>
              <Button type="button" variant="ghost" size="icon" onClick={() => { setOpen(false); setEditing(null); }}>
                ×
              </Button>
            </div>
            {/* Step 1: visual type picker */}
            <div className="space-y-1.5">
              <Label>{L("نوع المحتوى", "Content type")}</Label>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {Object.entries(TYPE_LABELS).map(([k, v]) => {
                  const active = editing.contentType === k;
                  const Icon = (props: { className?: string }) => (
                    <ContentTypeIcon type={k} {...props} />
                  );
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setEditing({ ...editing, contentType: k })}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "hover:border-primary/40 hover:bg-muted/50",
                      )}
                    >
                      <Icon className="size-5" />
                      <span className="text-[11px] font-bold leading-tight">{v[lang as "ar" | "en"]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <input type="hidden" name="contentType" value={editing.contentType} />
            <input type="hidden" name="status" value={editing.status} />
            <input type="hidden" name="authorId" value={editing.authorId} />
            <input type="hidden" name="narratorId" value={editing.narratorId} />
            <input type="hidden" name="publisherId" value={editing.publisherId} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{L("العنوان", "Title")} *</Label>
                <Input name="title" defaultValue={editing.title} required />
              </div>
              <div className="space-y-1.5">
                <Label>Slug *</Label>
                <Input name="slug" defaultValue={editing.slug} required dir="ltr" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{L("الوصف", "Description")} *</Label>
              <Textarea name="description" defaultValue={editing.description} rows={3} required />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>{L("الحالة", "Status")}</Label>
                <Select value={editing.status} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="published">published</SelectItem>
                    <SelectItem value="draft">draft</SelectItem>
                    <SelectItem value="archived">archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{L("المدة (دقائق)", "Duration (minutes)")}</Label>
                <Input name="duration" type="number" min="0" defaultValue={0} />
              </div>
              <div className="space-y-1.5">
                <Label>{L("لغة المحتوى", "Content language")}</Label>
                <Select value={editing.contentLang ?? "ar"} onValueChange={(v) => setEditing({ ...editing, contentLang: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ar">العربية</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="both">{L("ثنائية", "Bilingual")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>{L("المؤلف", "Author")}</Label>
                <Select value={editing.authorId} onValueChange={(v) => setEditing({ ...editing, authorId: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">—</SelectItem>
                    {authors?.map((a) => (
                      <SelectItem key={a._id} value={a._id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{L("الراوي", "Narrator")}</Label>
                <Select value={editing.narratorId} onValueChange={(v) => setEditing({ ...editing, narratorId: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">—</SelectItem>
                    {narrators?.map((n) => (
                      <SelectItem key={n._id} value={n._id}>{n.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{L("دار النشر", "Publisher")}</Label>
                <Select value={editing.publisherId} onValueChange={(v) => setEditing({ ...editing, publisherId: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">—</SelectItem>
                    {publishers?.map((p) => (
                      <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{L("رابط الغلاف", "Cover image URL")}</Label>
                <Input name="coverImage" key={`cover-${editing.coverImage ?? ""}`} defaultValue={editing.coverImage} dir="ltr" placeholder="https://..." />
                <FileUpload
                  accept="image/*"
                  label={L("أو ارفع صورة الغلاف", "Or upload a cover image")}
                  maxSizeMB={10}
                  className="w-full"
                  onUploaded={async (storageId) => {
                    try {
                      if (editing._id) {
                        await saveCoverUpload({ storageId: storageId as any, contentId: editing._id as any });
                        toast.success(L("تم رفع الغلاف وربطه", "Cover uploaded"));
                        setOpen(false);
                        setEditing(null);
                      } else {
                        const url = await (window as any).__getStorageUrl?.(storageId);
                        setEditing({ ...editing, coverImage: url ?? editing.coverImage });
                        toast.info(L("سيُرفق الغلاف عند الحفظ", "Cover will attach on save"));
                      }
                    } catch (err: any) {
                      toast.error(err.message);
                    }
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{L("رابط الملف الصوتي (MP3/M4A)", "Audio file URL (MP3/M4A)")}</Label>
                <Input name="audioUrl" defaultValue={editing.audioUrl} dir="ltr" placeholder="https://... .mp3" />
                <FileUpload
                  accept=".mp3,.m4a,audio/mpeg,audio/mp4,audio/*"
                  label={L("أو ارفع الملف الصوتي", "Or upload an audio file")}
                  maxSizeMB={80}
                  className="w-full"
                  onAudioUploaded={async (storageId, durationSeconds) => {
                    try {
                      if (editing._id) {
                        await saveAudioUpload({ storageId: storageId as any, target: { kind: "content", contentId: editing._id as any }, duration: durationSeconds });
                        toast.success(L(`تم رفع الصوت (${Math.round(durationSeconds / 60)} دقيقة)`, `Audio uploaded (${Math.round(durationSeconds / 60)} min)`));
                        setOpen(false);
                        setEditing(null);
                      } else {
                        toast.info(L("احفظ المحتوى أولًا ثم ارفع الصوت", "Save the content first, then upload audio"));
                      }
                    } catch (err: any) {
                      toast.error(err.message);
                    }
                  }}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{L("ملف الكتاب الإلكتروني (PDF/EPUB)", "E-book file (PDF/EPUB)")}</Label>
              <div className="flex flex-wrap items-center gap-2">
                <FileUpload
                  accept=".pdf,.epub,application/pdf,application/epub+zip"
                  label={editing.fileUrl ? L("استبدال الملف", "Replace file") : L("رفع PDF/EPUB", "Upload PDF/EPUB")}
                  maxSizeMB={100}
                  onUploaded={async (storageId) => {
                    try {
                      if (editing._id) {
                        await saveFileUpload({ storageId: storageId as any, contentId: editing._id as any });
                        toast.success(L("تم رفع الملف وربطه", "File uploaded"));
                      } else {
                        toast.info(L("احفظ المحتوى أولًا ثم ارفع الملف", "Save the content first, then upload the file"));
                      }
                    } catch (err: any) {
                      toast.error(err.message);
                    }
                  }}
                />
                {editing.fileUrl && (
                  <a
                    href={editing.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-primary hover:underline"
                    dir="ltr"
                  >
                    {L("عرض الملف الحالي ↗", "View current file ↗")}
                  </a>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{L("التصنيفات", "Categories")}</Label>
              <div className="flex flex-wrap gap-2">
                {categories?.map((c) => {
                  const active = editing.categoryIds.includes(c._id);
                  return (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() =>
                        setEditing({
                          ...editing,
                          categoryIds: active
                            ? editing.categoryIds.filter((x: string) => x !== c._id)
                            : [...editing.categoryIds, c._id],
                        })
                      }
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                        active ? "border-primary bg-primary text-white" : "hover:bg-muted",
                      )}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-wrap gap-6 pt-2">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" name="isFeatured" defaultChecked={editing.isFeatured} />
                {L("مميز (Featured)", "Featured")}
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" name="isTrending" defaultChecked={editing.isTrending} />
                {L("رائج (Trending)", "Trending")}
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" name="isNew" defaultChecked={editing.isNew} />
                {L("جديد (New)", "New")}
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => { setOpen(false); setEditing(null); }}>
                {L("إلغاء", "Cancel")}
              </Button>
              <Button type="submit" disabled={saving} className="font-bold">
                {saving && <Loader2 className="size-4 animate-spin" />}
                {L("حفظ", "Save")}
              </Button>
            </div>
            </div>

            {/* Live preview sidebar */}
            <aside className="space-y-3 lg:sticky lg:top-8 lg:self-start">
              <Label>{L("معاينة حية", "Live preview")}</Label>
              <div className="overflow-hidden rounded-xl border bg-card card-shadow">
                <img
                  src={previewCover || LOGO_COVER}
                  alt=""
                  className="aspect-[3/4] w-full object-cover"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = LOGO_COVER; }}
                />
              </div>
              <div className="rounded-xl border bg-card p-3">
                <p className="truncate text-sm font-bold">
                  {previewTitle || L("عنوان العمل…", "Work title…")}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {authors?.find((a) => a._id === editing.authorId)?.name ??
                    narrators?.find((n) => n._id === editing.narratorId)?.name ??
                    L("بدون مؤلف", "No author")}
                </p>
                <span className="mt-2 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                  {TYPE_LABELS[editing.contentType]?.[lang as "ar" | "en"] ?? editing.contentType}
                </span>
                <div className="mt-2 flex flex-wrap gap-1">
                  {editing.isFeatured && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">★</span>
                  )}
                  {editing.isTrending && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">🔥</span>
                  )}
                  {editing.isNew && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">NEW</span>
                  )}
                  {editing.status === "draft" && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">draft</span>
                  )}
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {L(
                  "تتحدث المعاينة تلقائيًا أثناء الكتابة — هكذا سيظهر العمل في المتجر.",
                  "Preview updates as you type — this is how the work will appear in the store.",
                )}
              </p>
            </aside>
          </form>
        </div>
      )}
    </div>
  );
}

// ============ Entities ============

function EntityManager({ L, initialTable }: { L: (ar: string, en: string) => string; initialTable?: "authors" | "narrators" | "publishers" | "categories" }) {
  const [table, setTable] = useState<"authors" | "narrators" | "publishers" | "categories">(initialTable ?? "authors");
  const items = useQuery(api.admin.listEntity, { table });
  const upsert = useMutation(api.admin.upsertEntity);
  const remove = useMutation(api.admin.deleteEntity);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const labels = {
    authors: L("المؤلفون", "Authors"),
    narrators: L("الرواة", "Narrators"),
    publishers: L("دور النشر", "Publishers"),
    categories: L("التصنيفات", "Categories"),
  };

  const handleAdd = async () => {
    if (!name.trim()) return;
    try {
      await upsert({ table, name, slug: slug || undefined } as any);
      setName("");
      setSlug("");
      toast.success(L("تمت الإضافة", "Added"));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-black">{L("إدارة الكيانات", "Manage entities")}</h2>
      <div className="mt-4 flex gap-2">
        {(Object.keys(labels) as (keyof typeof labels)[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTable(k)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
              table === k ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-border",
            )}
          >
            {labels[k]}
          </button>
        ))}
      </div>

      <div className="mt-6 flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={L("الاسم", "Name")} />
        {table === "categories" && (
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug" dir="ltr" />
        )}
        <Button onClick={handleAdd} className="shrink-0 font-bold">
          <Plus className="size-4" />
          {L("إضافة", "Add")}
        </Button>
      </div>

      {items === undefined ? (
        <Skeleton className="mt-6 h-48 rounded-2xl" />
      ) : (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item: any) => (
            <div key={item._id} className="flex items-center justify-between rounded-xl border bg-card p-3">
              <div>
                <p className="text-sm font-bold">{item.name}</p>
                {item.slug && <p className="text-xs text-muted-foreground" dir="ltr">{item.slug}</p>}
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete"
                onClick={async () => {
                  await remove({ table, id: item._id } as any);
                  toast.success(L("تم الحذف", "Deleted"));
                }}
              >
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ Plans ============

function PlansManager({ L, lang }: { L: (ar: string, en: string) => string; lang: string }) {
  const plans = useQuery(api.subscriptions.listPlans, {});
  const upsert = useMutation(api.subscriptions.upsertPlan);
  const remove = useMutation(api.subscriptions.deletePlan);
  const [editing, setEditing] = useState<any>(null);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black">{L("باقات الاشتراك", "Subscription plans")}</h2>
        <Button
          className="font-bold"
          onClick={() =>
            setEditing({
              name: "", nameEn: "", description: "", price: 0, currency: "SAR",
              period: "monthly", features: "", isPopular: false, isActive: true, order: 99,
            })
          }
        >
          <Plus className="size-4" />
          {L("باقة جديدة", "New plan")}
        </Button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {L("الأسعار والمميزات تُدار من هنا فقط — لا توجد أسعار ثابتة في الكود.", "Prices and features are managed here — no hardcoded prices.")}
      </p>

      {plans === undefined ? (
        <Skeleton className="mt-6 h-48 rounded-2xl" />
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan._id} className="rounded-2xl border bg-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-extrabold">{lang === "ar" ? plan.name : plan.nameEn}</p>
                  <p className="mt-1 text-2xl font-black">
                    {plan.price} <span className="text-xs font-semibold text-muted-foreground">{plan.currency}</span>
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setEditing({ ...plan, features: plan.features.join("\n") })}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={async () => { await remove({ id: plan._id }); toast.success(L("تم الحذف", "Deleted")); }}>
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {plan.features.slice(0, 4).map((f, i) => <li key={i}>• {f}</li>)}
              </ul>
              <div className="mt-3 flex gap-2">
                <Badge variant={plan.isActive ? "secondary" : "outline"} className={plan.isActive ? "bg-green-100 text-green-700" : ""}>
                  {plan.isActive ? L("مفعلة", "Active") : L("معطلة", "Inactive")}
                </Badge>
                {plan.isPopular && <Badge className="bg-primary text-white">{L("مميزة", "Popular")}</Badge>}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <form
            className="my-8 w-full max-w-lg space-y-4 rounded-3xl border bg-background p-6"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              try {
                await upsert({
                  id: editing._id,
                  name: String(form.get("name")),
                  nameEn: String(form.get("nameEn")) || undefined,
                  description: String(form.get("description")) || undefined,
                  price: Number(form.get("price")),
                  currency: String(form.get("currency")),
                  period: String(form.get("period")) as any,
                  features: String(form.get("features")).split("\n").map((s) => s.trim()).filter(Boolean),
                  isPopular: form.get("isPopular") === "on",
                  isActive: form.get("isActive") === "on",
                  order: Number(form.get("order") ?? 99),
                });
                toast.success(L("تم الحفظ", "Saved"));
                setEditing(null);
              } catch (err: any) {
                toast.error(err.message);
              }
            }}
          >
            <h3 className="text-lg font-black">{editing._id ? L("تعديل الباقة", "Edit plan") : L("باقة جديدة", "New plan")}</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{L("الاسم (عربي)", "Name (Arabic)")}</Label>
                <Input name="name" defaultValue={editing.name} required />
              </div>
              <div className="space-y-1.5">
                <Label>{L("الاسم (إنجليزي)", "Name (English)")}</Label>
                <Input name="nameEn" defaultValue={editing.nameEn} dir="ltr" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{L("الوصف", "Description")}</Label>
              <Input name="description" defaultValue={editing.description} />
            </div>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label>{L("السعر", "Price")}</Label>
                <Input name="price" type="number" min="0" step="0.01" defaultValue={editing.price} required />
              </div>
              <div className="space-y-1.5">
                <Label>{L("العملة", "Currency")}</Label>
                <Input name="currency" defaultValue={editing.currency} dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label>{L("المدة", "Period")}</Label>
                <Select name="period" defaultValue={editing.period}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">monthly</SelectItem>
                    <SelectItem value="yearly">yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{L("الترتيب", "Order")}</Label>
                <Input name="order" type="number" defaultValue={editing.order} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{L("المميزات (سطر لكل ميزة)", "Features (one per line)")}</Label>
              <Textarea name="features" rows={5} defaultValue={editing.features} />
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" name="isPopular" defaultChecked={editing.isPopular} />
                {L("الأكثر شيوعًا", "Popular")}
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" name="isActive" defaultChecked={editing.isActive} />
                {L("مفعلة", "Active")}
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                {L("إلغاء", "Cancel")}
              </Button>
              <Button type="submit" className="font-bold">{L("حفظ", "Save")}</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ============ Challenges ============

function ChallengesManager({ L }: { L: (ar: string, en: string) => string }) {
  const items = useQuery(api.engagement.listChallenges, {});
  const upsert = useMutation(api.adminContent.upsertChallenge);
  const remove = useMutation(api.adminContent.deleteChallenge);
  const [editing, setEditing] = useState<any>(null);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black">{L("التحديات", "Challenges")}</h2>
        <Button
          className="font-bold"
          onClick={() => setEditing({ name: "", description: "", startDate: "", endDate: "", reward: "", status: "upcoming", isActive: true, goalType: "listen_minutes", goalTarget: 600 })}
        >
          <Plus className="size-4" />
          {L("تحدي جديد", "New challenge")}
        </Button>
      </div>

      {items === undefined ? (
        <Skeleton className="mt-6 h-48 rounded-2xl" />
      ) : (
        <div className="mt-6 space-y-3">
          {items.map((ch) => (
            <div key={ch._id} className="flex items-center justify-between rounded-2xl border bg-card p-4">
              <div>
                <p className="font-bold">{ch.name}</p>
                <p className="text-xs text-muted-foreground">{ch.startDate} → {ch.endDate} · {ch.participants} {L("مشارك", "participants")}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => setEditing({ ...ch })}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={async () => { await remove({ id: ch._id }); toast.success(L("تم الحذف", "Deleted")); }}>
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <form
            className="my-8 w-full max-w-lg space-y-4 rounded-3xl border bg-background p-6"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              try {
                await upsert({
                  id: editing._id,
                  name: String(form.get("name")),
                  description: String(form.get("description")),
                  startDate: String(form.get("startDate")),
                  endDate: String(form.get("endDate")),
                  reward: String(form.get("reward")) || undefined,
                  status: String(form.get("status")) as any,
                  isActive: form.get("isActive") === "on",
                  goalType: (String(form.get("goalType")) || "listen_minutes") as any,
                  goalTarget: Number(form.get("goalTarget")) || undefined,
                });
                toast.success(L("تم الحفظ", "Saved"));
                setEditing(null);
              } catch (err: any) {
                toast.error(err.message);
              }
            }}
          >
            <h3 className="text-lg font-black">{editing._id ? L("تعديل التحدي", "Edit challenge") : L("تحدي جديد", "New challenge")}</h3>
            <div className="space-y-1.5">
              <Label>{L("الاسم", "Name")} *</Label>
              <Input name="name" defaultValue={editing.name} required />
            </div>
            <div className="space-y-1.5">
              <Label>{L("الوصف", "Description")} *</Label>
              <Textarea name="description" defaultValue={editing.description} rows={2} required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{L("تاريخ البدء", "Start date")}</Label>
                <Input name="startDate" type="date" defaultValue={editing.startDate} required />
              </div>
              <div className="space-y-1.5">
                <Label>{L("تاريخ الانتهاء", "End date")}</Label>
                <Input name="endDate" type="date" defaultValue={editing.endDate} required />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{L("المكافأة", "Reward")}</Label>
                <Input name="reward" defaultValue={editing.reward} />
              </div>
              <div className="space-y-1.5">
                <Label>{L("الحالة", "Status")}</Label>
                <Select name="status" defaultValue={editing.status}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">upcoming</SelectItem>
                    <SelectItem value="active">active</SelectItem>
                    <SelectItem value="ended">ended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{L("نوع الهدف", "Goal type")}</Label>
                <Select name="goalType" defaultValue={editing.goalType ?? "listen_minutes"}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="listen_minutes">{L("دقائق استماع", "Listen minutes")}</SelectItem>
                    <SelectItem value="finished_works">{L("أعمال مكتملة (٩٥٪+)", "Finished works (95%+)")}</SelectItem>
                    <SelectItem value="rated_items">{L("تقييمات مكتوبة", "Ratings written")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{L("قيمة الهدف", "Goal target")}</Label>
                <Input name="goalTarget" type="number" min={1} defaultValue={editing.goalTarget ?? 600} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" name="isActive" defaultChecked={editing.isActive} />
              {L("نشط", "Active")}
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>{L("إلغاء", "Cancel")}</Button>
              <Button type="submit" className="font-bold">{L("حفظ", "Save")}</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ============ Live ============

function LiveManager({ L }: { L: (ar: string, en: string) => string }) {
  const items = useQuery(api.engagement.listLiveStreams, {});
  const upsert = useMutation(api.adminContent.upsertLiveStream);
  const remove = useMutation(api.adminContent.deleteLiveStream);
  const [editing, setEditing] = useState<any>(null);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black">{L("البث المباشر", "Live streams")}</h2>
        <Button
          className="font-bold"
          onClick={() => setEditing({ title: "", hostName: "", description: "", scheduledStart: "", scheduledEnd: "", streamUrl: "", isLive: false })}
        >
          <Plus className="size-4" />
          {L("بث جديد", "New stream")}
        </Button>
      </div>

      {items === undefined ? (
        <Skeleton className="mt-6 h-48 rounded-2xl" />
      ) : (
        <div className="mt-6 space-y-3">
          {items.map((s) => (
            <div key={s._id} className="flex items-center justify-between rounded-2xl border bg-card p-4">
              <div>
                <p className="font-bold">{s.title} {s.isLive && <Badge className="ms-2 bg-red-600 text-white">LIVE</Badge>}</p>
                <p className="text-xs text-muted-foreground">{s.hostName} · {s.scheduledStart}-{s.scheduledEnd}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => setEditing({ ...s })}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={async () => { await remove({ id: s._id }); toast.success(L("تم الحذف", "Deleted")); }}>
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <form
            className="my-8 w-full max-w-lg space-y-4 rounded-3xl border bg-background p-6"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              try {
                await upsert({
                  id: editing._id,
                  title: String(form.get("title")),
                  hostName: String(form.get("hostName")),
                  description: String(form.get("description")) || undefined,
                  streamUrl: String(form.get("streamUrl")) || undefined,
                  scheduledStart: String(form.get("scheduledStart")) || undefined,
                  scheduledEnd: String(form.get("scheduledEnd")) || undefined,
                  isLive: form.get("isLive") === "on",
                });
                toast.success(L("تم الحفظ", "Saved"));
                setEditing(null);
              } catch (err: any) {
                toast.error(err.message);
              }
            }}
          >
            <h3 className="text-lg font-black">{editing._id ? L("تعديل البث", "Edit stream") : L("بث جديد", "New stream")}</h3>
            <div className="space-y-1.5">
              <Label>{L("اسم البرنامج", "Program title")} *</Label>
              <Input name="title" defaultValue={editing.title} required />
            </div>
            <div className="space-y-1.5">
              <Label>{L("المقدم", "Host")} *</Label>
              <Input name="hostName" defaultValue={editing.hostName} required />
            </div>
            <div className="space-y-1.5">
              <Label>{L("الوصف", "Description")}</Label>
              <Textarea name="description" defaultValue={editing.description} rows={2} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{L("بداية البث", "Start")}</Label>
                <Input name="scheduledStart" defaultValue={editing.scheduledStart} placeholder="20:00" dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label>{L("نهاية البث", "End")}</Label>
                <Input name="scheduledEnd" defaultValue={editing.scheduledEnd} placeholder="22:00" dir="ltr" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{L("رابط البث (HLS/ICE)", "Stream URL (HLS/ICE)")}</Label>
              <Input name="streamUrl" defaultValue={editing.streamUrl} dir="ltr" placeholder="https://..." />
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" name="isLive" defaultChecked={editing.isLive} />
              {L("على الهواء الآن", "On air now")}
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>{L("إلغاء", "Cancel")}</Button>
              <Button type="submit" className="font-bold">{L("حفظ", "Save")}</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ============ Submissions ============

function SubmissionsManager({ L }: { L: (ar: string, en: string) => string }) {
  const items = useQuery(api.adminContent.listSubmissions, {});
  const update = useMutation(api.adminContent.updateSubmissionStatus);

  const statusColors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    reviewing: "bg-blue-100 text-blue-700",
    accepted: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
  };

  return (
    <div>
      <h2 className="text-xl font-black">{L("طلبات نشر المحتوى", "Publisher submissions")}</h2>
      {items === undefined ? (
        <Skeleton className="mt-6 h-48 rounded-2xl" />
      ) : items.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">{L("لا توجد طلبات بعد", "No submissions yet")}</p>
      ) : (
        <div className="mt-6 space-y-3">
          {items.map((s) => (
            <div key={s._id} className="rounded-2xl border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{s.workTitle}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {s.name} · <span dir="ltr">{s.email}</span> {s.publisherName && `· ${s.publisherName}`}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.contentType} · {s.ownerType} · {new Date(s.createdAt).toLocaleDateString("ar")}
                  </p>
                  {s.message && <p className="mt-2 max-w-xl text-sm">{s.message}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={statusColors[s.status]}>{s.status}</Badge>
                  <Select
                    value={s.status}
                    onValueChange={async (v) => {
                      await update({ id: s._id, status: v as any });
                      toast.success(L("تم التحديث", "Updated"));
                    }}
                  >
                    <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">pending</SelectItem>
                      <SelectItem value="reviewing">reviewing</SelectItem>
                      <SelectItem value="accepted">accepted</SelectItem>
                      <SelectItem value="rejected">rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ Users ============

function AccessManager({ L }: { L: (ar: string, en: string) => string }) {
  const me = useQuery(api.adminUsers.me, {});
  const gateStatus = useQuery(api.adminGate.status, {});
  const setGatePassword = useMutation(api.adminGate.setPassword);
  const isAdmin = me?.isAdmin ?? false;

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [saving, setSaving] = useState(false);

  const submitPw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 8) {
      toast.error(L("كلمة المرور يجب أن تكون 8 أحرف على الأقل", "Password must be at least 8 characters"));
      return;
    }
    if (newPw !== newPw2) {
      toast.error(L("كلمتا المرور غير متطابقتين", "Passwords do not match"));
      return;
    }
    setSaving(true);
    try {
      await setGatePassword({
        currentPassword: gateStatus?.configured ? currentPw : undefined,
        newPassword: newPw,
      });
      toast.success(L("تم تحديث كلمة مرور اللوحة", "Dashboard password updated"));
      setCurrentPw("");
      setNewPw("");
      setNewPw2("");
      try { sessionStorage.removeItem("haki_admin_gate_token"); } catch { /* noop */ }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const roleDescriptions: { role: string; label: string; desc: string }[] = [
    { role: "super_admin", label: L("مدير النظام", "Super Admin"), desc: L("تحكم كامل: النظام، الإعدادات، الأدوار، منح Super Admin", "Full control: system, settings, roles, granting Super Admin") },
    { role: "admin", label: L("مدير", "Admin"), desc: L("إدارة كل المحتوى والمستخدمين والباقات — بلا تعديل مديري النظام", "Manage all content, users, plans — cannot edit Super Admins") },
    { role: "publisher", label: L("ناشر", "Publisher"), desc: L("إدارة محتوى دار النشر الخاصة به فقط", "Manage only their imprint's content") },
    { role: "author", label: L("مؤلف", "Author"), desc: L("إدارة أعماله الخاصة فقط", "Manage only their own works") },
    { role: "user", label: L("مستخدم", "User"), desc: L("تصفح واستماع — لا وصول للوحة التحكم", "Browse & listen — no dashboard access") },
  ];

  return (
    <div>
      <h2 className="text-xl font-black">{L("الوصول والأدوار", "Access & roles")}</h2>

      <div className="mt-6 max-w-xl rounded-2xl border bg-card p-6">
        <h3 className="flex items-center gap-2 font-extrabold">
          <KeyRound className="size-4 text-primary" />
          {L("كلمة مرور لوحة التحكم", "Dashboard password")}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {gateStatus?.configured
            ? L("مفعّلة — تُطلب عند كل جلسة إدارة جديدة. تغييرها يُنهي جلسات البوابة الحالية.", "Enabled — required each admin session. Changing it ends current gate sessions.")
            : L("لم تُضبط بعد — ستُطلب في أول فتح للوحة.", "Not set yet — will be asked on first dashboard open.")}
        </p>
        {isAdmin ? (
          <form onSubmit={submitPw} className="mt-4 space-y-3">
            {gateStatus?.configured && (
              <Input type="password" dir="ltr" placeholder={L("كلمة المرور الحالية", "Current password")} value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} autoComplete="current-password" />
            )}
            <Input type="password" dir="ltr" placeholder={L("كلمة المرور الجديدة (8+ أحرف)", "New password (8+ chars)")} value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" />
            <Input type="password" dir="ltr" placeholder={L("تأكيد كلمة المرور الجديدة", "Confirm new password")} value={newPw2} onChange={(e) => setNewPw2(e.target.value)} autoComplete="new-password" />
            <Button type="submit" className="font-bold" disabled={saving}>
              {saving ? "…" : L("حفظ كلمة المرور", "Save password")}
            </Button>
          </form>
        ) : (
          <p className="mt-4 rounded-xl bg-muted p-3 text-sm">
            {L("ضبط كلمة المرور متاح للمديرين فقط.", "Only admins can set the password.")}
          </p>
        )}
      </div>

      <div className="mt-6 max-w-xl rounded-2xl border bg-card p-6">
        <h3 className="flex items-center gap-2 font-extrabold">
          <RefreshCw className="size-4 text-primary" />
          {L("توزيع الأدوار", "Role assignment")}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {L("من تبويب «المستخدمون» تختار دور كل عضو من القائمة المنسدلة بجانب اسمه.", "In the Users tab, pick each member's role from the dropdown next to their name.")}
        </p>
        <div className="mt-4 space-y-2.5">
          {roleDescriptions.map((r) => (
            <div key={r.role} className="rounded-xl border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold">{r.label}</p>
                <code className="text-[10px] text-muted-foreground" dir="ltr">{r.role}</code>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{r.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function UsersManager({ L }: { L: (ar: string, en: string) => string }) {
  const me = useQuery(api.adminUsers.me, {});
  const users = useQuery(api.adminUsers.listUsers, {});
  const setRole = useMutation(api.adminUsers.setUserRole);
  const canAssignSuper = me?.role === "super_admin";

  const roleLabels: Record<string, string> = {
    super_admin: L("مدير النظام", "Super Admin"),
    admin: L("مدير", "Admin"),
    publisher: L("ناشر", "Publisher"),
    author: L("مؤلف", "Author"),
    user: L("مستخدم", "User"),
    member: L("مستخدم (قديم)", "User (legacy)"),
  };

  return (
    <div>
      <h2 className="text-xl font-black">{L("المستخدمون", "Users")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {L(
          "الأدوار: مدير النظام يدير كل شيء، المدير يدير المحتوى والمستخدمين، الناشر يدير محتوى داره فقط، المؤلف يدير أعماله فقط.",
          "Roles: Super Admin runs everything, Admin manages content & users, Publisher manages only their imprint, Author only their works.",
        )}
      </p>
      {users === undefined ? (
        <Skeleton className="mt-6 h-48 rounded-2xl" />
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border bg-card">
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>{L("المستخدم", "User")}</TH>
                  <TH>{L("الدور", "Role")}</TH>
                </TR>
              </THead>
              <TBody>
                {users.map((u) => (
                  <TR key={u._id}>
                    <TD>
                      <p className="text-sm font-bold">
                        {u.name ?? "—"}
                        {u._id === me?._id && (
                          <span className="ms-2 text-xs font-semibold text-primary">({L("أنت", "you")})</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground" dir="ltr">{u.email ?? "—"}</p>
                    </TD>
                    <TD>
                      {u._id === me?._id ? (
                        <Badge variant="secondary">{roleLabels[u.role ?? "user"] ?? u.role}</Badge>
                      ) : (
                        <Select value={u.role ?? "user"} onValueChange={(v) => setRole({ userId: u._id, role: v as any })}>
                          <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">{roleLabels.user}</SelectItem>
                            <SelectItem value="author">{roleLabels.author}</SelectItem>
                            <SelectItem value="publisher">{roleLabels.publisher}</SelectItem>
                            <SelectItem value="admin">{roleLabels.admin}</SelectItem>
                            {canAssignSuper && <SelectItem value="super_admin">{roleLabels.super_admin}</SelectItem>}
                          </SelectContent>
                        </Select>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Settings ============

function SettingsManager({ L }: { L: (ar: string, en: string) => string }) {
  const settings = useQuery(api.adminContent.listSettings, {});
  const setSetting = useMutation(api.adminContent.setSetting);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");

  return (
    <div>
      <h2 className="text-xl font-black">{L("إعدادات المنصة", "Platform settings")}</h2>
      {settings === undefined ? (
        <Skeleton className="mt-6 h-48 rounded-2xl" />
      ) : (
        <div className="mt-6 space-y-2">
          {settings.map((s) => (
            <div key={s._id} className="flex items-center justify-between rounded-xl border bg-card p-3.5">
              <div>
                <p className="text-sm font-bold" dir="ltr">{s.key}</p>
                <p className="text-xs text-muted-foreground" dir="ltr">{s.value}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setKey(s.key);
                  setValue(s.value);
                }}
              >
                <Pencil className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <form
        className="mt-6 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!key.trim()) return;
          await setSetting({ key, value });
          toast.success(L("تم الحفظ", "Saved"));
          setKey("");
          setValue("");
        }}
      >
        <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="key" dir="ltr" />
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={L("القيمة", "value")} />
        <Button type="submit" className="shrink-0 font-bold">{L("حفظ", "Save")}</Button>
      </form>
      <SeedPanel L={L} />
    </div>
  );
}

// ============ Table primitives (simple) ============

function Table({ children }: { children: React.ReactNode }) {
  return <table className="w-full min-w-[600px] text-sm">{children}</table>;
}
function THead({ children }: { children: React.ReactNode }) {
  return <thead><tr className="border-b bg-secondary/60">{children}</tr></thead>;
}
function TBody({ children }: { children: React.ReactNode }) {
  return <tbody>{children}</tbody>;
}
function TR({ children }: { children: React.ReactNode }) {
  return <tr className="border-b last:border-0">{children}</tr>;
}
function TH({ children }: { children: React.ReactNode }) {
  return <th className="p-3 text-start text-xs font-semibold text-muted-foreground">{children}</th>;
}
function TD({ children }: { children: React.ReactNode }) {
  return <td className="p-3">{children}</td>;
}

export default function AdminDashboard() {
  return (
    <RequireAuth
      title="هذه الصفحة للمديرين فقط"
      description="سجّل الدخول بحساب مدير للوصول إلى لوحة التحكم."
    >
      <RoleGate />
    </RequireAuth>
  );
}

function RoleGate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const hasAdmin = useQuery(api.seed.hasAnyAdmin, {});
  const bootstrap = useMutation(api.seed.bootstrapAdmin);

  // Bootstrap: if no admin exists yet, the first signed-in visitor becomes admin.
  useEffect(() => {
    if (user && hasAdmin === false) {
      void bootstrap().catch(() => undefined);
    }
  }, [user, hasAdmin, bootstrap]);

  if (user && hasAdmin === false) {
    // Promotion is in flight — show a short pending state.
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">جارٍ تجهيز حسابك كمدير للمنصة…</p>
      </div>
    );
  }

  const role = user?.role;
  const staff = role === "super_admin" || role === "admin" || role === "publisher" || role === "author";

  if (user && !staff) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <Shield className="size-10 text-muted-foreground" />
        <p className="text-lg font-bold">هذه الصفحة لفريق الإدارة فقط</p>
        <p className="text-sm text-muted-foreground">
          حسابك بدور "مستخدم" ولا يملك صلاحية الوصول إلى لوحة التحكم. تواصل مع الإدارة إذا كنت تحتاج صلاحيات ناشر أو مؤلف أو مدير.
        </p>
        <Button onClick={() => navigate("/")}>العودة للرئيسية</Button>
      </div>
    );
  }
  // Password gate on top of the role check (managed in Settings tab).
  return (
    <PasswordGate>
      <AdminInner />
    </PasswordGate>
  );
}

function PasswordGate({ children }: { children: React.ReactNode }) {
  return <AdminGate>{children}</AdminGate>;
}
