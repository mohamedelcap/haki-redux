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
import { useMutation } from "convex/react";
import { Check, Languages, Loader2, LogOut, Pencil, Trash2 } from "lucide-react";
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

  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

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
              <Label>{L("البريد الإلكتروني", "Email")}</Label>
              <span className="block text-sm font-semibold" dir="ltr">
                {user?.email ?? "—"}
              </span>
            </div>
          </div>
        </section>

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
        </section>
      </div>
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
