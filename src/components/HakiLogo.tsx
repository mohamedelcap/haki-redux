import { cn } from "@/lib/utils";

/**
 * شعار حكي | HAKI — مكوّن SVG واحد بوضعين:
 *
 * - "colored": نسخة الألوان — خلفية برتقالية وحبر أسود (كما في اللوجو المعتمد)
 * - "outline": نسخة مفرّغة — حبر مفرّغ بحدود رقيقة، للخلفيات الداكنة والفوتر
 *
 * الرسم الكاليغرافي مبني على مسارات مرسومة يدويًا تحاكي ضربات القلم:
 * الحاء على شكل نصل مائل، والكاف بحلقة كبيرة، والياء بحلقة سفلية بنقطتين.
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
  const ink = isOutline ? "currentColor" : "#111111";
  const inkOpacity = isOutline ? 1 : 1;
  const plate = isOutline ? "none" : "#F97316";
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
        fillOpacity={inkOpacity}
        stroke={isOutline ? "currentColor" : "none"}
        strokeWidth={isOutline ? 2.2 : 0}
        strokeLinejoin="round"
      >
        {/* الضمة العلوية — ضربة القلم الطويلة المائلة */}
        <path d="M32 28c15-8 38-10 53-4 1.7.7 1.8 2.9.1 3.5-6 2.1-17 4.2-28.2 4.2-10.4 0-20.8-1.3-25.6-2.8-.9-.3-1-1.4.7-1.9Z" />
        {/* الفتحة الصغيرة على الحاء */}
        <path d="M53.5 41.5c5.2-2.4 11.5-3.1 15.5-1.9 1.5.5 1.6 2.1.1 2.6-3.6 1.1-9.6 1.3-14 .7-1.9-.3-3.2-1.2-1.6-1.4Z" />
        {/* الحاء — الضربة العمودية الكبيرة مع الطرف المفتوح لأسفل */}
        <path d="M46 44.5c3.8-1.9 8.6-1.7 12 .6 3.5 2.4 5.2 6.6 4.3 10.6-.9 4.2-4.2 7.4-8.4 8.3-1.1.2-1.5-1.1-.6-1.7 2.7-1.9 4.8-4.9 5.3-7.9.6-3.5-.9-6.9-3.7-8.7-2.8-1.8-6.8-2-10.2-.6-1.7.7-2.4-1-1.3-1.6Z" />
        {/* قوس الحاء الداخلي (الفتحة السفلية) */}
        <path d="M44.8 51.8c2.6-1.3 5.8-1 7.9.8 2.1 1.8 2.9 4.7 2 7.2-.4 1.1-1.8.9-1.8-.2 0-1.9-.9-3.6-2.5-4.6-1.6-1-3.7-1-5.4-.2-1.4.7-1.8-2.4-.2-3Z" />
        {/* الكاف — الحلقة الكبيرة: قوس علوي من الحاء ينزل إلى اليمين */}
        <path d="M60.5 76.5c-9.5-2.2-16.8-7.6-19-14.4-2.1-6.6 1-13.2 7.6-15.8 1.4-.5 2.4 1 1.2 1.7-4.8 2.7-7.2 7.8-5.7 13 1.6 5.7 7.5 10.6 15.3 12.7 1.5.4 1.4 2.1-.4 1.8Z" />
        {/* ذيل الكاف السفلي الممتد لليمين */}
        <path d="M54.5 79.5c7 .8 14.8-.2 21-2.9 1.9-.8 3 .9 1.3 1.8-6 3.2-14.5 4.6-22.6 3.4-1.8-.3-1.7-1.8.3-1.7Z" />
        {/* الياء السفلية — الحلقة الصغيرة */}
        <path d="M62.5 85.5c2.8-1.4 6.4-1.1 8.7.7 2.3 1.8 3.1 4.6 2.2 7.1-.4 1-1.7.8-1.8-.2-.2-1.9-1.4-3.5-3.1-4.3-1.7-.8-3.8-.7-5.5.2-1.2.6-1.9-2.7-.5-3.5Z" />
        {/* نقطتا الياء */}
        <circle cx="77" cy="95" r="2.7" />
        <circle cx="84.5" cy="95" r="2.7" />
      </g>

      {/* كلمة HAKI */}
      {!hideWordmark && (
        <text
          x="60"
          y="111"
          textAnchor="middle"
          fill={ink}
          fillOpacity={inkOpacity}
          stroke={isOutline ? "currentColor" : "none"}
          strokeWidth={isOutline ? 0.6 : 0}
          style={{
            fontFamily: "Inter, Cairo, sans-serif",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 6,
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
