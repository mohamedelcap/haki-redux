import { api } from "@/convex/_generated/api";
import { FileUpload } from "@/components/FileUpload";
import { SEO } from "@/components/SEO";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, Check, Languages, Loader2, LogOut, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

function SettingsInner() {
  const { lang, setLang, t } = useLang();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const L = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const updateName = useMutation(api.profile.updateName);
  const saveAvatar = useMutation(api.files.saveAvatar);
  const removeAvatar = useMutation(api.profile.removeImage);
  const setUsername = useMutation(api.account.setUsername);
  const deleteMyAccount = useMutation(api.account.deleteMyAccount);
  const stats = useQuery(api.account.myStats, {});

  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [username, setUsernameVal] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);

  useEffect(() => {
    if (user?.name) setName(user.name);
    if (user?.username) setUsernameVal(user.username);
  }, [user?.name, user?.username]);

  const saveUsername = async () => {
    setSavingUsername(true);
    try {
      await setUsername({ username });
      toast.success(L("تم حفظ اسم المستخدم", "Username saved"));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingUsername(false);
    }
  };

  const saveName = async () => {
    setSavingName(true);
    try {
      await updateName({ name });
      toast.success(L("تم حفظ الاسم", "Name saved"));
      setEditingName(false);
    } catch (e: any) {
      toast.error(e.message ?? L("تعذّر الحفظ", "Failed to save"));
    } finally {
      setSavingName(false);
    }
  };

  return (
    <div className="py-10">
      <SEO title={`${t("settings")} | حكي`} />
      <div className="haki-container max-w-2xl">
        <h1 className="text-2xl font-black sm:text-3xl">{t("settings")}</h1>

        {/* ---------- Profile ---------- */}
        <section className="mt-8 rounded-2xl border bg-card p-6 card-shadow">
          <h2 className="font-extrabold">{L("الملف الشخصي", "Profile")}</h2>

          <div className="mt-5 flex items-center gap-4">
            <Avatar className="size-16 border">
              {user?.image ? (
                <AvatarImage src={user.image} alt="" />
              ) : (
                <AvatarFallback className="bg-accent text-xl font-black text-accent-foreground">
                  {(user?.name ?? user?.email ?? "؟").charAt(0).toUpperCase()}
                </AvatarFallback>
              )}
            </Avatar>
            <div className="flex flex-wrap items-center gap-2">
              <FileUpload
                accept="image/*"
                label={L("تغيير الصورة", "Change photo")}
                maxSizeMB={5}
                onUploaded={async (storageId) => {
                  try {
                    await saveAvatar({ storageId: storageId as any });
                    toast.success(L("تم تحديث الصورة", "Photo updated"));
                  } catch (e: any) {
                    toast.error(e.message);
                  }
                }}
              />
              {user?.image && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-muted-foreground"
                  onClick={async () => {
                    try {
                      await removeAvatar({});
                      toast.success(L("أُزيلت الصورة", "Photo removed"));
                    } catch (e: any) {
                      toast.error(e.message);
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                  {L("إزالة", "Remove")}
                </Button>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="settings-name">{L("الاسم", "Name")}</Label>
              {editingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    id="settings-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={savingName}
                  />
                  <Button size="icon" onClick={saveName} disabled={savingName} aria-label={L("حفظ", "Save")}>
                    {savingName ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Check className="size-4" />
                    )}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{user?.name ?? "—"}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => setEditingName(true)}
                    aria-label={L("تعديل الاسم", "Edit name")}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="settings-username">{L("اسم المستخدم", "Username")}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="settings-username"
                  value={username}
                  onChange={(e) => setUsernameVal(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  placeholder={L("book_lover99", "book_lover99")}
                  dir="ltr"
                  maxLength={20}
                  className="max-w-56"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={savingUsername || username === (user?.username ?? "") || username.length < 3}
                  onClick={saveUsername}
                >
                  {savingUsername ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  {L("حفظ", "Save")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {L("3-20 حرفًا: إنجليزي/أرقام/شرطة سفلية — فريد لكل مستخدم.", "3-20 chars: letters/digits/underscore — unique per user.")}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>{L("البريد الإلكتروني", "Email")}</Label>
              <span className="block text-sm font-semibold" dir="ltr">
                {user?.email ?? "—"}
              </span>
            </div>
          </div>
        </section>

        {/* ---------- Email notifications ---------- */}
        <EmailPrefsSection L={L} />

        {/* ---------- Language ---------- */}
        <section className="mt-6 rounded-2xl border bg-card p-6 card-shadow">
          <div className="flex items-center gap-3">
            <Languages className="size-5 text-primary" />
            <h2 className="font-extrabold">{L("لغة الواجهة", "Interface language")}</h2>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setLang("ar")}
              className={cn(
                "rounded-xl border p-4 text-start transition-colors",
                lang === "ar" ? "border-primary bg-accent/60" : "hover:bg-muted",
              )}
            >
              <p className="font-bold">العربية</p>
              <p className="text-xs text-muted-foreground">Arabic (RTL)</p>
            </button>
            <button
              type="button"
              onClick={() => setLang("en")}
              className={cn(
                "rounded-xl border p-4 text-start transition-colors",
                lang === "en" ? "border-primary bg-accent/60" : "hover:bg-muted",
              )}
            >
              <p className="font-bold">English</p>
              <p className="text-xs text-muted-foreground">English (LTR)</p>
            </button>
          </div>
        </section>

        {/* ---------- My stats ---------- */}
        <section className="mt-6 rounded-2xl border bg-card p-6 card-shadow">
          <h2 className="font-extrabold">{L("إحصائياتي", "My stats")}</h2>
          {stats === undefined ? (
            <Skeleton className="mt-4 h-16 rounded-xl" />
          ) : stats === null ? (
            <p className="mt-2 text-sm text-muted-foreground">{L("سجّل الدخول لعرض إحصائياتك.", "Sign in to see your stats.")}</p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatTile label={L("دقائق استماع", "Listening minutes")} value={stats.minutes} />
              <StatTile label={L("أعمال استمعت لها", "Works listened")} value={stats.works} />
              <StatTile label={L("جلسات استماع", "Play sessions")} value={stats.listens} />
              <StatTile label={L("تقييماتي", "My ratings")} value={stats.ratings} />
              <StatTile label={L("في قائمتي", "In my list")} value={stats.myList} />
              <StatTile label={L("قيد الاستماع", "In progress")} value={stats.inProgress} />
            </div>
          )}
        </section>

        {/* ---------- Account ---------- */}
        <section className="mt-6 rounded-2xl border bg-card p-6 card-shadow">
          <h2 className="font-extrabold">{L("الحساب", "Account")}</h2>
          <Button
            variant="destructive"
            className="mt-4"
            onClick={async () => {
              await signOut();
              navigate("/");
            }}
          >
            <LogOut className="size-4" />
            {t("signOut")}
          </Button>

          <div className="mt-8 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-destructive">
              <AlertTriangle className="size-4" />
              {L("منطقة الخطر", "Danger zone")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {L(
                "حذف الحساب نهائي: يُحذف سجل الاستماع والتقييمات وقائمتك ولا يمكن التراجع.",
                "Deleting your account is permanent: history, ratings and lists are erased and cannot be undone.",
              )}
            </p>
            <Button
              variant="destructive"
              size="sm"
              className="mt-3"
              onClick={async () => {
                if (!window.confirm(L("هل أنت متأكد تمامًا؟ اكتب نعم للتأكيد", "Are you absolutely sure? Type yes to confirm"))) return;
                const answer = window.prompt(L("اكتب \"حذف\" للتأكيد النهائي", "Type \"DELETE\" to confirm"));
                if (answer !== (lang === "ar" ? "حذف" : "DELETE")) {
                  toast.error(L("لم يُحذف الحساب — التأكيد غير مطابق", "Account not deleted — confirmation mismatch"));
                  return;
                }
                try {
                  await deleteMyAccount({});
                  toast.success(L("تم حذف حسابك نهائيًا", "Your account was deleted"));
                  await signOut();
                  navigate("/");
                } catch (e: any) {
                  toast.error(e.message);
                }
              }}
            >
              <Trash2 className="size-4" />
              {L("حذف حسابي نهائيًا", "Delete my account")}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

function EmailPrefsSection({ L }: { L: (ar: string, en: string) => string }) {
  const prefs = useQuery(api.emailPrefs.getMine, {});
  const setPrefs = useMutation(api.emailPrefs.setMine);
  const [state, setState] = useState<{ welcome: boolean; receipt: boolean; episode: boolean } | null>(null);
  const effective = state ?? prefs?.pref ?? null;

  const toggle = async (k: "welcome" | "receipt" | "episode", v: boolean) => {
    if (!effective) return;
    const next = { ...effective, [k]: v };
    setState(next);
    try {
      await setPrefs(next);
      toast.success(L("تم الحفظ", "Saved"));
    } catch (e: any) {
      toast.error(e.message);
      setState(null);
    }
  };

  const rows = [
    { key: "welcome" as const, label: L("رسالة الترحيب", "Welcome email"), desc: L("عند إنشاء حساب جديد", "When a new account is created") },
    { key: "receipt" as const, label: L("إيصالات الاشتراك", "Subscription receipts"), desc: L("عند تفعيل باقة مدفوعة", "When a paid plan is activated") },
    { key: "episode" as const, label: L("حلقات بودكاست جديدة", "New podcast episodes"), desc: L("للبودكاستات التي تتابعها", "For podcasts you follow") },
  ];

  return (
    <section className="mt-6 rounded-2xl border bg-card p-6 card-shadow">
      <h2 className="font-extrabold">{L("إشعارات البريد الإلكتروني", "Email notifications")}</h2>
      {prefs === null ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {L("أضف بريدًا لحسابك لتظهر إعدادات البريد.", "Add an email to your account to manage email settings.")}
        </p>
      ) : prefs === undefined || !effective ? (
        <Skeleton className="mt-4 h-24 rounded-xl" />
      ) : (
        <div className="mt-4 space-y-3">
          {rows.map((r) => (
            <div key={r.key} className="flex items-center justify-between gap-4 rounded-xl border p-3">
              <div>
                <p className="text-sm font-bold">{r.label}</p>
                <p className="text-xs text-muted-foreground">{r.desc}</p>
              </div>
              <Switch checked={effective[r.key]} onCheckedChange={(v) => toggle(r.key, v)} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-accent/60 p-3 text-center">
      <p className="text-xl font-black tabular-nums">{value}</p>
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
    </div>
  );
}

export default function Settings() {
  return (
    <RequireAuth title="سجّل الدخول للإعدادات" description="إعدادات الحساب متاحة للمستخدمين المسجلين.">
      <SettingsInner />
    </RequireAuth>
  );
}
