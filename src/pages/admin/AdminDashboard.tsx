import { api } from "@/convex/_generated/api";
import { FileUpload } from "@/components/FileUpload";
import { RequireAuth } from "@/components/RequireAuth";
import { TracksManager } from "@/pages/admin/TracksManager";
import { HomepageManager } from "@/pages/admin/HomepageManager";
import { MediaLibrary } from "@/pages/admin/MediaLibrary";
import { SEO } from "@/components/SEO";
import { HakiLogo } from "@/components/HakiLogo";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Crown,
  FileText,
  Flame,
  Headphones,
  Images,
  LayoutDashboard,
  Loader2,
  ListMusic,
  Mic,
  Pencil,
  Plus,
  Radio,
  Settings2,
  Shield,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  Upload,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

type TabKey =
  | "overview"
  | "content"
  | "tracks"
  | "homepage"
  | "media"
  | "entities"
  | "plans"
  | "challenges"
  | "live"
  | "submissions"
  | "users"
  | "settings";

function AdminInner() {
  const { lang } = useLang();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("overview");

  const L = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const tabs: { key: TabKey; label: string; icon: any }[] = [
    { key: "overview", label: L("نظرة عامة", "Overview"), icon: BarChart3 },
    { key: "content", label: L("المحتوى", "Content"), icon: Headphones },
    { key: "tracks", label: L("الفصول والحلقات", "Tracks"), icon: ListMusic },
    { key: "homepage", label: L("الصفحة الرئيسية", "Homepage"), icon: LayoutDashboard },
    { key: "media", label: L("الوسائط", "Media"), icon: Images },
    { key: "entities", label: L("المؤلفون والتصنيفات", "Entities"), icon: BookOpen },
    { key: "plans", label: L("الباقات", "Plans"), icon: Crown },
    { key: "challenges", label: L("التحديات", "Challenges"), icon: Trophy },
    { key: "live", label: L("البث المباشر", "Live"), icon: Radio },
    { key: "submissions", label: L("طلبات النشر", "Submissions"), icon: FileText },
    { key: "users", label: L("المستخدمون", "Users"), icon: Users },
    { key: "settings", label: L("الإعدادات", "Settings"), icon: Settings2 },
  ];

  return (
    <div className="min-h-screen bg-secondary/40">
      <SEO title={`${L("لوحة الإدارة", "Admin")} | حكي`} />
      {/* Admin header */}
      <div className="border-b bg-background">
        <div className="haki-container flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="icon" aria-label="Back">
                <ArrowLeft className="size-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-2.5">
              <HakiLogo variant="outline" size={36} hideWordmark className="text-foreground" />
              <div>
                <h1 className="font-logo text-lg font-black leading-tight">لوحة تحكم حكي</h1>
                <p className="text-xs text-muted-foreground" dir="ltr">{user?.email}</p>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await signOut();
              navigate("/");
            }}
          >
            {L("خروج", "Sign out")}
          </Button>
        </div>
        {/* Tabs */}
        <div className="haki-container">
          <div className="no-scrollbar flex gap-1 overflow-x-auto pb-2">
            {tabs.map((tb) => (
              <button
                key={tb.key}
                type="button"
                onClick={() => setTab(tb.key)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors",
                  tab === tb.key
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <tb.icon className="size-3.5" />
                {tb.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="haki-container py-8">
        {tab === "overview" && <Overview lang={lang} L={L} />}
        {tab === "content" && <ContentManager L={L} lang={lang} />}
        {tab === "tracks" && <TracksManager L={L} />}
        {tab === "homepage" && <HomepageManager L={L} />}
        {tab === "media" && <MediaLibrary L={L} />}
        {tab === "entities" && <EntityManager L={L} />}
        {tab === "plans" && <PlansManager L={L} lang={lang} />}
        {tab === "challenges" && <ChallengesManager L={L} />}
        {tab === "live" && <LiveManager L={L} />}
        {tab === "submissions" && <SubmissionsManager L={L} />}
        {tab === "users" && <UsersManager L={L} />}
        {tab === "settings" && <SettingsManager L={L} />}
      </div>
    </div>
  );
}

// ============ Overview ============

function Overview({ lang, L }: { lang: string; L: (ar: string, en: string) => string }) {
  const stats = useQuery(api.admin.stats, {});
  const cards = [
    { label: L("المستخدمون", "Users"), value: stats?.users, icon: Users },
    { label: L("المحتويات", "Content"), value: stats?.content, icon: Headphones },
    { label: L("كتب صوتية", "Audiobooks"), value: stats?.audiobooks, icon: Headphones },
    { label: L("كتب إلكترونية", "E-books"), value: stats?.ebooks, icon: BookOpen },
    { label: L("دراما", "Drama"), value: stats?.dramas, icon: Mic },
    { label: L("بودكاست", "Podcasts"), value: stats?.podcasts, icon: Mic },
    { label: L("المشتركون", "Subscribers"), value: stats?.subscribers, icon: Crown },
    { label: L("مرات الاستماع", "Total plays"), value: stats?.totalPlays, icon: BarChart3 },
    { label: L("ساعات الاستماع (تقديري)", "Est. listen hours"), value: stats?.totalListenHours, icon: BarChart3 },
  ];
  return (
    <div>
      <h2 className="text-xl font-black">{L("إحصائيات المنصة", "Platform statistics")}</h2>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border bg-card p-4 card-shadow">
            <c.icon className="size-4 text-primary" />
            <p className="mt-2 text-2xl font-black tabular-nums">
              {c.value === undefined ? "…" : c.value.toLocaleString(lang === "ar" ? "ar" : "en")}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>
      <SeedPanel L={L} />
    </div>
  );
}

function SeedPanel({ L }: { L: (ar: string, en: string) => string }) {
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

function ContentManager({ L, lang }: { L: (ar: string, en: string) => string; lang: string }) {
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
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [editing, setEditing] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const empty = {
    title: "",
    slug: "",
    description: "",
    contentType: "audiobook",
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
                {items
                  .filter((i) => typeFilter === "all" || i.contentType === typeFilter)
                  .map((item) => (
                  <TR key={item._id}>
                    <TD>
                      <div className="flex items-center gap-2.5">
                        <img src={item.coverImage || "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=480&h=720&fit=crop&q=80"} alt="" className="size-9 rounded-md object-cover" />
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
            className="my-8 w-full max-w-2xl space-y-4 rounded-3xl border bg-background p-6"
          >
            <h3 className="text-lg font-black">
              {editing._id ? L("تعديل محتوى", "Edit content") : L("إضافة محتوى", "Add content")}
            </h3>
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
                <Label>{L("النوع", "Type")}</Label>
                <Select value={editing.contentType} onValueChange={(v) => setEditing({ ...editing, contentType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v[lang as "ar" | "en"]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                  onUploaded={async (storageId) => {
                    try {
                      if (editing._id) {
                        await saveAudioUpload({ storageId: storageId as any, target: { kind: "content", contentId: editing._id as any } });
                        toast.success(L("تم رفع الصوت وربطه", "Audio uploaded"));
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
          </form>
        </div>
      )}
    </div>
  );
}

// ============ Entities ============

function EntityManager({ L }: { L: (ar: string, en: string) => string }) {
  const [table, setTable] = useState<"authors" | "narrators" | "publishers" | "categories">("authors");
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
          onClick={() => setEditing({ name: "", description: "", startDate: "", endDate: "", reward: "", status: "upcoming", isActive: true })}
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
      <AdminGate />
    </RequireAuth>
  );
}

function AdminGate() {
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
  return <AdminInner />;
}
