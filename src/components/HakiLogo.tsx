import { cn } from "@/lib/utils";

/**
 * شعار حكي | HAKI — النسخة المعتمدة من هوية المنصة.
 *
 * الشكل: ضربة كاليغرافية علوية ممتدة (الضمة)، جسم مركزي ضخم (الحاء)،
 * قوس سفلي واسع يمتد يمينًا (الكاف)، حلقة صغيرة بنقطتين (الياء)،
 * وتحته كلمة HAKI بتباعد حروف واسع — داخل بطاقة داكنة مستديرة.
 *
 * - "colored": البطاقة الداكنة مع حبر فاتح (الشكل الرسمي كما ورد في الهوية)
 * - "outline": حبر مفرّغ بـ currentColor — للخلفيات الداكنة والفوتر
 *
 * الرسم مبني على مسارات مرسومة يدويًا تحاكي ضربات القلم الحقيقية.
 */

type HakiLogoProps = {
  variant?: "colored" | "outline";
  /** عرض البطاقة بالبكسل — الارتفاع يتبعها تلقائيًا (نسبة مربعة) */
  size?: number;
  className?: string;
  /** إخفاء كلمة HAKI أسفل الرسم */
  hideWordmark?: boolean;
};

export function HakiLogo({
  variant = "colored",
  size = 40,
  className,
  hideWordmark = false,
}: HakiLogoProps) {
  const isOutline = variant === "outline";

  // ألوان الحبر والخلفية حسب النسخة
  const ink = isOutline ? "currentColor" : "#EDEDEA";
  const plate = isOutline ? "none" : "#141414";
  const plateStroke = isOutline ? "currentColor" : "none";
  const plateStrokeOpacity = isOutline ? 0.9 : 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      role="img"
      aria-label="حكي"
    >
      {/* البطاقة الخلفية */}
      <rect
        x="1.5"
        y="1.5"
        width="117"
        height="117"
        rx="24"
        fill={plate}
        stroke={plateStroke}
        strokeWidth={isOutline ? 3 : 0}
        strokeOpacity={plateStrokeOpacity}
      />

      {/* رسم حكي الكاليغرافي */}
      <g
        fill={ink}
        stroke={isOutline ? "currentColor" : "none"}
        strokeWidth={isOutline ? 2.2 : 0}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {/* الضمة العلوية — الضربة الممتدة الطويلة التي تنساب يمينًا */}
        <path d="M44 30.5c9-4.5 22-7 33.5-6 4.5.4 9.5 1.6 12.5 3.4 1.6 1 .9 2.6-.9 2.5-4.3-.2-9.9-1.2-15.6-1.2-10.5 0-20.9 2.2-28.3 5.4-2.4 1-3.4-3-.2-4.1Z" />
        {/* الفتحة الصغيرة على الكتف */}
        <path d="M60.5 43.5c4.8-2 11-2.6 15.2-1.5 1.6.4 1.7 2.2.1 2.7-3.7 1.1-9.9 1.4-14.4.8-2-.3-3-1.6-.9-2Z" />
        {/* الحاء — الجسم المركزي الضخم: رأس مستدير ينزل بذيل مفتوح */}
        <path d="M52.5 47.5c4.4-2.6 10.6-2.4 15.2.6 4.7 3.1 7 8.4 6 13.6-.5 2.6-1.8 5-3.7 6.8-.9.9-2.3-.1-1.7-1.2 1.5-2.7 2.3-5.9 1.8-8.9-.7-4.6-4.2-8.3-8.8-9.4-4.4-1.1-9 .2-12.3 3.2-1.2 1.1-2.9-.9-1.3-2.1Z" />
        {/* امتلاء الجسم — ضربة داخلية تعطي الوزن الكاليغرافي */}
        <path d="M56.5 53.5c2.8-1.6 6.6-1.5 9.5.3 3 1.8 4.7 5 4.4 8.3-.1 1.2-1.8 1.3-2.2.2-.9-2.6-2.9-4.7-5.5-5.6-2.5-.9-5.3-.7-7.6.5-1.4.7-2.6-2.3 1.4-3.7Z" />
        {/* الكاف — القوس السفلي الواسع المنفتح يمينًا */}
        <path d="M62 84.5c-8.8-1.5-16.8-5.6-20.8-11.3-3.8-5.4-3.5-11.9.8-16.4 1.1-1.2 2.9.4 2 1.8-2.9 4.5-2.9 9.5.3 13.6 3.9 5 11.4 8.4 19.7 9.5 1.9.3 1.7 2.4-.4 2.2Z" />
        {/* ذيل الكاف — امتداد الضربة لليمين تحت الجسم */}
        <path d="M58.5 88.5c6.8 1.3 15 .8 21.6-1.5 2.1-.7 3.1 1.6 1.1 2.5-6.8 3-15.9 3.8-23.4 2-2-.5-1.4-2.7.7-2.2Z" />
        {/* الياء السفلية — الحلقة الصغيرة */}
        <path d="M64.5 92.5c2.6-1.2 5.9-.9 8 .8 2.1 1.7 2.8 4.3 1.9 6.6-.4 1-1.8.7-1.9-.3-.2-1.7-1.3-3.2-2.9-3.9-1.6-.7-3.5-.6-5 .2-1.3.7-2-2.7-.1-3.4Z" />
        {/* نقطتا الياء */}
        <circle cx="78.5" cy="99.5" r="2.4" />
        <circle cx="85.5" cy="99.5" r="2.4" />
      </g>

      {/* كلمة HAKI */}
      {!hideWordmark && (
        <text
          x="60"
          y="111.5"
          textAnchor="middle"
          fill={ink}
          stroke={isOutline ? "currentColor" : "none"}
          strokeWidth={isOutline ? 0.6 : 0}
          style={{
            fontFamily: "Inter, Cairo, sans-serif",
            fontSize: 12.5,
            fontWeight: 500,
            letterSpacing: 7,
          }}
        >
          HAKI
        </text>
      )}
    </svg>
  );
}

/** شعار مدمج للهيدر: الرسم + كلمة حكي بجانبه */
export function HakiLogoInline({
  variant = "colored",
  size = 36,
  wordClass,
  className,
}: {
  variant?: "colored" | "outline";
  size?: number;
  /** الكلمة المصاحبة — بالعربية أو الإنجليزية حسب اللغة */
  wordClass?: string;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <HakiLogo variant={variant} size={size} hideWordmark />
      {/* extra line-height so Aref Ruqaa's calligraphic descenders are not clipped */}
      <span className={cn("font-logo text-2xl font-bold leading-[1.5] pb-1", wordClass)}>
        حكي
      </span>
    </span>
  );
}
