/**
 * وسائل الدفع المتاحة عند الاشتراك — عربية ودولية.
 * كل وسيلة لها مفتاح يطابق paymentMethods.ts على الخادم أو method تعسفي
 * يُعامل كتحويل يدوي (bankTransfer/cod) أو بوابات مستقبلية.
 */

export type PayMethod = {
  key: string;
  ar: string;
  en: string;
  descAr: string;
  descEn: string;
  /** يعرض شعارات نصية للبطاقات المدعومة */
  badges?: string[];
  region: "international" | "arab";
  icon: "card" | "wallet" | "bank" | "cash" | "mobile";
};

export const PAYMENT_METHODS: PayMethod[] = [
  {
    key: "stripe",
    ar: "بطاقة ائتمانية",
    en: "Credit / debit card",
    descAr: "فيزا وماستركارد ومدى عبر Stripe — دفع آمن ومشفّر",
    descEn: "Visa, Mastercard & mada via Stripe — secure checkout",
    badges: ["VISA", "Mastercard", "mada"],
    region: "international",
    icon: "card",
  },
  {
    key: "applepay",
    ar: "Apple Pay",
    en: "Apple Pay",
    descAr: "دفع سريع بلمسة واحدة من أجهزة Apple",
    descEn: "One-tap checkout from Apple devices",
    region: "international",
    icon: "wallet",
  },
  {
    key: "stcpay",
    ar: "STC Pay",
    en: "STC Pay",
    descAr: "محفظة STC Pay — الدفع الرقمي الأشهر في السعودية",
    descEn: "STC Pay — leading digital wallet in Saudi Arabia",
    region: "arab",
    icon: "mobile",
  },
  {
    key: "fawry",
    ar: "فوري",
    en: "Fawry",
    descAr: "ادفع من أي منفذ فوري في مصر — أكثر من 200 ألف نقطة",
    descEn: "Pay at 200K+ Fawry outlets across Egypt",
    region: "arab",
    icon: "mobile",
  },
  {
    key: "vodafonecash",
    ar: "فودافون كاش",
    en: "Vodafone Cash",
    descAr: "محفظة فودافون كاش — دفع فوري من الهاتف",
    descEn: "Instant mobile wallet payment",
    region: "arab",
    icon: "mobile",
  },
  {
    key: "bankTransfer",
    ar: "تحويل بنكي",
    en: "Bank transfer",
    descAr: "حوّل المبلغ إلى حساب المنصة وأرسل الإيصال",
    descEn: "Transfer to the platform account and send the receipt",
    region: "international",
    icon: "bank",
  },
];
