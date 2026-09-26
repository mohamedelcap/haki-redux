/**
 * الشعار الرسمي لمنصة حكي — ملف PNG المرفوع في قسم Assets.
 * يُستخدم في كل مواضع الموقع التي تحتاج صورة غلاف/أفاتار/احتياطية
 * بدل أي صور خارجية — هوية واحدة موحدة كما وردت في الملف المعتمد.
 */
export const LOGO_PNG = "/logo.png";
export const LOGO_ASSETS_PNG = "/assets/fm2134691.png";

const LEGACY_PATHS = [
  // الضمة العلوية الممتدة
  "M44 30.5c9-4.5 22-7 33.5-6 4.5.4 9.5 1.6 12.5 3.4 1.6 1 .9 2.6-.9 2.5-4.3-.2-9.9-1.2-15.6-1.2-10.5 0-20.9 2.2-28.3 5.4-2.4 1-3.4-3-.2-4.1Z",
  // الفتحة الصغيرة على الكتف
  "M60.5 43.5c4.8-2 11-2.6 15.2-1.5 1.6.4 1.7 2.2.1 2.7-3.7 1.1-9.9 1.4-14.4.8-2-.3-3-1.6-.9-2Z",
  // الحاء — الجسم المركزي
  "M52.5 47.5c4.4-2.6 10.6-2.4 15.2.6 4.7 3.1 7 8.4 6 13.6-.5 2.6-1.8 5-3.7 6.8-.9.9-2.3-.1-1.7-1.2 1.5-2.7 2.3-5.9 1.8-8.9-.7-4.6-4.2-8.3-8.8-9.4-4.4-1.1-9 .2-12.3 3.2-1.2 1.1-2.9-.9-1.3-2.1Z",
  // امتلاء الجسم
  "M56.5 53.5c2.8-1.6 6.6-1.5 9.5.3 3 1.8 4.7 5 4.4 8.3-.1 1.2-1.8 1.3-2.2.2-.9-2.6-2.9-4.7-5.5-5.6-2.5-.9-5.3-.7-7.6.5-1.4.7-2.6-2.3 1.4-3.7Z",
  // الكاف — القوس السفلي الواسع
  "M62 84.5c-8.8-1.5-16.8-5.6-20.8-11.3-3.8-5.4-3.5-11.9.8-16.4 1.1-1.2 2.9.4 2 1.8-2.9 4.5-2.9 9.5.3 13.6 3.9 5 11.4 8.4 19.7 9.5 1.9.3 1.7 2.4-.4 2.2Z",
  // ذيل الكاف
  "M58.5 88.5c6.8 1.3 15 .8 21.6-1.5 2.1-.7 3.1 1.6 1.1 2.5-6.8 3-15.9 3.8-23.4 2-2-.5-1.4-2.7.7-2.2Z",
  // الياء السفلية
  "M64.5 92.5c2.6-1.2 5.9-.9 8 .8 2.1 1.7 2.8 4.3 1.9 6.6-.4 1-1.8.7-1.9-.3-.2-1.7-1.3-3.2-2.9-3.9-1.6-.7-3.5-.6-5 .2-1.3.7-2-2.7-.1-3.4Z",
];

const LEGACY_CIRCLES: [number, number, number][] = [
  [78.5, 99.5, 2.4],
  [85.5, 99.5, 2.4],
];

function buildLogoSvg(withWordmark: boolean): string {
  const body = [
    ...LEGACY_PATHS.map((d) => `<path d="${d}"/>`),
    ...LEGACY_CIRCLES.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`),
  ].join("");

  const wordmark = withWordmark
    ? `<text x="60" y="111.5" text-anchor="middle" fill="#111111" style="font-family: Inter, Cairo, sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 6.5px">HAKI</text>`
    : "";

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 120 120">` +
    `<rect x="0" y="0" width="120" height="120" fill="#F97316"/>` +
    `<g fill="#111111">${body}</g>` +
    wordmark +
    `</svg>`
  );
}

const encoded = (svg: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

/** غلاف مربع بالشعار الرسمي — ملف PNG الرسمي من قسم Assets. */
export const LOGO_COVER = LOGO_PNG;

/** نسخة SVG (data-URI) — احتياطية للسياقات التي تتطلب SVG. */
export const LOGO_SVG_URI = encoded(buildLogoSvg(false));

/** غلاف بالشعار مع كلمة HAKI (SVG data-URI). */
export const LOGO_COVER_WORDMARK = encoded(buildLogoSvg(true));
