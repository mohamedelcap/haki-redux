import { api } from "@/convex/_generated/api";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useLang } from "@/lib/i18n";
import { useMutation } from "convex/react";
import {
  BookOpen,
  CheckCircle2,
  CloudUpload,
  Mic,
  Newspaper,
  Podcast,
  Theater,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

const CONTENT_TYPE_OPTIONS = [
  { value: "audiobook", ar: "كتاب صوتي", en: "Audiobook", icon: Mic },
  { value: "ebook", ar: "كتاب إلكتروني", en: "E-book", icon: BookOpen },
  { value: "audio_drama", ar: "دراما صوتية", en: "Audio drama", icon: Theater },
  { value: "podcast", ar: "بودكاست", en: "Podcast", icon: Podcast },
  { value: "magazine", ar: "مجلة", en: "Magazine", icon: Newspaper },
  { value: "other", ar: "محتوى آخر", en: "Other", icon: Mic },
];

const OWNER_TYPES = [
  { value: "author", ar: "مؤلف", en: "Author" },
  { value: "publisher", ar: "دار نشر", en: "Publisher" },
  { value: "creator", ar: "صانع محتوى", en: "Content creator" },
  { value: "narrator", ar: "راوٍ", en: "Narrator" },
];

export default function Publish() {
  const { lang } = useLang();
  const submit = useMutation(api.adminContent.submitPublisherForm);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [ownerType, setOwnerType] = useState("author");
  const [contentType, setContentType] = useState("audiobook");

  const L = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      await submit({
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        phone: String(form.get("phone") ?? "") || undefined,
        ownerType,
        publisherName: String(form.get("publisherName") ?? "") || undefined,
        workTitle: String(form.get("workTitle") ?? ""),
        contentType,
        message: String(form.get("message") ?? "") || undefined,
        fileName: fileName ?? undefined,
      });
      setSubmitted(true);
    } catch (err) {
      toast.error(L("حدث خطأ، حاول مرة أخرى", "Something went wrong, try again"));
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="py-24">
        <SEO title={`${L("انشر محتواك", "Publish")} | حكي`} />
        <div className="haki-container flex flex-col items-center text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-accent">
            <CheckCircle2 className="size-8 text-accent-foreground" />
          </div>
          <h1 className="mt-6 text-2xl font-black sm:text-3xl">
            {L("تم استلام طلبك بنجاح!", "Request received!")}
          </h1>
          <p className="mt-3 max-w-md text-muted-foreground">
            {L(
              "سيراجع فريق حكي طلبك ويتواصل معك خلال 3-5 أيام عمل عبر البريد الإلكتروني.",
              "The HAKI team will review your request and contact you within 3-5 business days.",
            )}
          </p>
          <Button variant="outline" className="mt-8" onClick={() => setSubmitted(false)}>
            {L("إرسال طلب آخر", "Submit another")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-10">
      <SEO title={`${L("انشر محتواك", "Publish content")} | حكي`} />
      <div className="haki-container max-w-3xl">
        <div className="text-center">
          <h1 className="text-3xl font-black sm:text-4xl">{L("انشر محتواك على حكي", "Publish on HAKI")}</h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            {L(
              "انشر كتبك ومحتواك الصوتي مع حكي واوصل إلى آلاف المستمعين في العالم العربي. املأ النموذج وسيتواصل معك فريقنا.",
              "Publish your books and audio content with HAKI and reach thousands of listeners. Fill the form and our team will reach out.",
            )}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-10 space-y-5 rounded-3xl border bg-card p-6 card-shadow sm:p-8">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">{L("الاسم الكامل", "Full name")} *</Label>
              <Input id="name" name="name" required placeholder={L("مثال: محمد أحمد", "e.g. Mohammed Ahmed")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{L("البريد الإلكتروني", "Email")} *</Label>
              <Input id="email" name="email" type="email" required placeholder="name@example.com" dir="ltr" />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">{L("رقم الهاتف", "Phone number")}</Label>
              <Input id="phone" name="phone" type="tel" placeholder="+9665xxxxxxxx" dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>{L("نوع صاحب المحتوى", "Content owner type")}</Label>
              <Select value={ownerType} onValueChange={setOwnerType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OWNER_TYPES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {L(o.ar, o.en)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="publisherName">
              {L("اسم دار النشر (إن وجد)", "Publisher name (optional)")}
            </Label>
            <Input id="publisherName" name="publisherName" placeholder={L("اسم دار النشر", "Publisher name")} />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="workTitle">{L("عنوان العمل", "Work title")} *</Label>
              <Input id="workTitle" name="workTitle" required placeholder={L("عنوان الكتاب أو العمل", "Title of the work")} />
            </div>
            <div className="space-y-2">
              <Label>{L("نوع المحتوى", "Content type")}</Label>
              <Select value={contentType} onValueChange={setContentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      <span className="flex items-center gap-2">
                        <o.icon className="size-3.5 text-primary" />
                        {L(o.ar, o.en)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">{L("رسالة", "Message")}</Label>
            <Textarea
              id="message"
              name="message"
              rows={4}
              placeholder={L(
                "أخبرنا عن عملك وعدد الفصول أو الحلقات، وأي تفاصيل تساعدنا في مراجعة طلبك...",
                "Tell us about your work, number of chapters or episodes, and anything that helps us review...",
              )}
            />
          </div>

          <div className="space-y-2">
            <Label>{L("رفع ملف (اختياري)", "Upload a file (optional)")}</Label>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed p-6 text-sm text-muted-foreground transition-colors hover:bg-muted"
            >
              <CloudUpload className="size-6 text-primary" />
              {fileName ? (
                <span className="font-semibold text-foreground">{fileName}</span>
              ) : (
                <span>{L("اضغط لاختيار ملف (PDF, MP3, M4A)", "Click to choose a file (PDF, MP3, M4A)")}</span>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.mp3,.m4a,.epub,audio/*"
              className="hidden"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            />
          </div>

          <Button type="submit" size="lg" className="w-full font-bold" disabled={loading}>
            {loading ? L("جارٍ الإرسال...", "Sending...") : L("إرسال الطلب", "Submit request")}
          </Button>
        </form>
      </div>
    </div>
  );
}
