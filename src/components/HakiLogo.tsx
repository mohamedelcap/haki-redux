import { cn } from "@/lib/utils";

/**
 * شعار حكي | HAKI — يعرض ملف الشعار الرسمي المرفوع في قسم Assets
 * (public/assets/fm2134691.png منسوخًا إلى public/logo.png) كما هو،
 * بدون أي تعديل على التصميم — في كل مواضع الموقع.
 */

export const LOGO_FILE = "/logo.png";

type HakiLogoProps = {
  /** للتوافق مع الاستدعاءات القديمة — لا يؤثر على الشكل الرسمي. */
  variant?: "colored" | "outline";
  /** العرض/الارتفاع بالبكسل (الملف مربع). */
  size?: number;
  className?: string;
  /** للتوافق — الشعار الرسمي يتضمن كلمة HAKI دائمًا. */
  hideWordmark?: boolean;
};

export function HakiLogo({
  size = 40,
  className,
}: HakiLogoProps = {}) {
  return (
    <img
      src={LOGO_FILE}
      alt="حكي"
      width={size}
      height={size}
      loading="eager"
      draggable={false}
      className={cn("shrink-0 select-none object-contain", className)}
    />
  );
}

/** شعار الهيدر — الملف الرسمي كما هو (بدون كلمة إضافية بجانبه). */
export function HakiLogoInline({
  size = 36,
  className,
}: {
  variant?: "colored" | "outline";
  size?: number;
  wordClass?: string;
  className?: string;
}) {
  return <HakiLogo size={size} className={className} />;
}
