import { motion } from "framer-motion";
import { Crown, Star, Play } from "lucide-react";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";

export default function Pricing() {
  const features = [
    "وصول غير محدود للمكتبة",
    "بدون إعلانات",
    "جودة صوت عالية",
    "محتوى حصري للمشتركين",
    "دعم فني على مدار الساعة",
  ];

  const pricing = [
    {
      plan: "شهري",
      value: "65",
      valueSuffix: "ج.م",
      period: "شهرياً",
      ctaText: "اشترك الآن",
      icon: Star,
      badge: null,
    },
    {
      plan: "ربع سنوي",
      value: "150",
      valueSuffix: "ج.م",
      period: "3 أشهر",
      ctaText: "اشترك الآن",
      icon: Crown,
      badge: { text: "الأكثر شعبية", color: "text-white", bg: "bg-orange-500", glow: "shadow-orange-500/30" },
    },
    {
      plan: "سنوي",
      value: "450",
      valueSuffix: "ج.م",
      period: "سنوياً",
      ctaText: "اشترك الآن",
      icon: Play,
      badge: { text: "أفضل قيمة", color: "text-white", bg: "bg-orange-500", glow: null },
      save: "وفر 200 ج.م",
    },
  ];

  return (
    <div className="min-h-screen">
      <SEO
        title="الأسعار والخطط — حكي"
        description="اختر الباقة المناسبة لك: سنوي، رباعي السنوات، أو شهري. وصول غير محدود، بدون إعلانات، ودعم فني على مدار الساعة."
      />

      {/* Hero headline */}
      <section className="py-12 text-center sm:py-16">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-3xl font-black leading-tight text-foreground sm:text-4xl lg:text-5xl"
        >
          استمتع بآلاف الكتب الصوتية
        </motion.h1>
        <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground sm:text-lg">
          اختر الباقة المناسب لك وابدأ رحلتك في عالم المعرفة والترفيه
        </p>
      </section>

      {/* Pricing cards */}
      <section className="py-10 sm:py-14">
        <div className="haki-container">
          <div className="grid gap-5 md:grid-cols-3 md:gap-6 lg:gap-8 items-stretch max-[420px]:mx-auto max-[420px]:max-w-lg">
            {pricing.map((p, i) => {
              const Icon = p.icon;
              return (
                <div
                  key={p.plan}
                  className={`relative flex flex-col rounded-2xl border p-5 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring ${
                    i === 1
                      ? "bg-orange-500 border-orange-500/40 shadow-lg shadow-orange-500/20 md:-translate-y-2 md:shadow-xl md:scale-105"
                      : "bg-card border-border shadow-sm hover:shadow-md hover:-translate-y-1"
                  }`}
                >
                  {/* Badge */}
                  {p.badge && (
                    <span
                      className={`absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold tracking-wide ${p.badge.bg} ${p.badge.color}`}
                    >
                      {p.badge.text}
                    </span>
                  )}

                  {/* Top icon */}
                  <div
                    className={`mx-auto mb-4 flex size-11 items-center justify-center rounded-xl ${i === 1 ? "bg-orange-400" : "bg-amber-100"}`}
                  >
                    <Icon className={`size-5 ${i === 1 ? "text-white" : "text-amber-700"}`} />
                  </div>

                  {/* Plan title */}
                  <h2 className="text-lg font-black">
                    {p.plan}
                  </h2>

                  {/* Price */}
                  <div
                    className="mt-4 flex items-baseline"
                  >
                    <span
                      className={`text-4xl font-black tabular-nums ${i === 1 ? "text-white" : "text-foreground"}`}
                    >
                      {p.value}
                    </span>
                    <span
                      className={`ml-1 text-sm font-medium ${i === 1 ? "text-white/80" : "text-muted-foreground"}`}
                    >
                      {p.valueSuffix}
                    </span>
                  </div>
                  <p
                    className={`mt-0.5 text-xs font-medium ${i === 1 ? "text-white/70" : "text-muted-foreground"}`}
                  >
                    {p.period}
                  </p>

                  {(p.save || i === 1) && (
                    <div
                      className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                        i === 1 ? "bg-green-100 text-green-800" : "bg-green-50 text-green-700"
                      }`}
                    >
                      {p.save ?? "وفر 200 ج.م"}
                    </div>
                  )}

                  {/* Features */}
                  <ul
                    className="mt-4 flex-1 space-y-2.5 pr-1"
                  >
                    {features.map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-2.5"
                      >
                        <span
                          className={`mt-0.5 size-5 shrink-0 rounded-full ${
                            i === 1 ? "bg-green-500/20" : "bg-green-500/15"
                          }`}
                        >
                          <svg
                            viewBox="0 0 16 16"
                            className={`size-3 fill-current ${i === 1 ? "text-green-400" : "text-green-600"}`}
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path d="M4 12.5l4.5-4.5L8 10l4.5-4.5L12 7.5 10 6l-4 4z" />
                          </svg>
                        </span>
                        <span
                          className={`text-xs leading-relaxed ${i === 1 ? "text-white/85" : "text-muted-foreground"}`}
                        >
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Button
                    variant={i === 1 ? "secondary" : "default"}
                    className="mt-5 w-full py-3.5 text-base font-bold tracking-wide"
                  >
                    {p.ctaText}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA / payment methods */}
      <section className="pb-16 sm:pb-20">
        <div className="haki-container">
          <div className="mx-auto max-w-2xl text-center">
            <motion.h2
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-2xl font-black sm:text-3xl"
            >
              وسائل الدفع المتاحة
            </motion.h2>
            <p className="mt-3 text-sm text-muted-foreground">
              دفع آمن عبر بطاقات البنوك والهواتف المحمولة وإلكترونيات الدفع
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
