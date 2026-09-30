import { cn } from "@/lib/utils";

/**
 * شعار حكي | HAKI — يعرض ملف الشعار الرسمي المرفوع في قسم Assets
 * (public/logo.png — رسم أسود على خلفية شفافة).
 *
 * في الوضع الليلي يقلب CSS فلترًا لونيًا الشعار إلى الأبيض حتى يظهر بوضوح
 * على الخلفيات الداكنة (المربع البرتقالي يبقى برتقاليًا لأن الفلتر يستهدف
 * الألوان الغامقة فقط عبر soft-light/السطوع).
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
      className={cn("haki-logo shrink-0 select-none object-contain", className)}
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
