import { api } from "@/convex/_generated/api";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useAction, useMutation, useQuery } from "convex/react";
import { Check, Crown, Sparkles } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function Subscriptions() {
  const { lang, t } = useLang();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const plans = useQuery(api.subscriptions.listPlans, { activeOnly: true });
  const mySub = useQuery(api.subscriptions.mySubscription, {});
  const subscribe = useMutation(api.subscriptions.subscribe);
  const cancelSub = useMutation(api.subscriptions.cancelMySubscription);
  const createCheckout = useAction(api.payments.createCheckoutSession);
  const activateAfterCheckout = useAction(api.payments.activateAfterCheckout);
  const [paying, setPaying] = useState<string | null>(null);

  // Handle return from Stripe Checkout (?success=1&session_id=...).
  useEffect(() => {
    const success = searchParams.get("success");
    const sessionId = searchParams.get("session_id");
    if (success && sessionId && isAuthenticated) {
      activateAfterCheckout({ sessionId })
        .then(() => {
          toast.success(
            lang === "ar" ? "تم تفعيل اشتراكك بنجاح 🎉" : "Subscription activated 🎉",
          );
        })
        .catch((e: any) => toast.error(e.message ?? "خطأ"))
        .finally(() => {
          setSearchParams({}, { replace: true });
        });
    } else if (searchParams.get("cancelled")) {
      toast.info(lang === "ar" ? "أُلغيت عملية الدفع" : "Checkout cancelled");
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isAuthenticated]);

  const handleSubscribe = async (planId: string) => {
    if (!isAuthenticated) {
      toast.error(lang === "ar" ? "سجّل الدخول للاشتراك" : "Sign in to subscribe");
      navigate("/auth?returnTo=%2Fsubscriptions");
      return;
    }
    if ((mySub?.plan as any)?._id === planId) return;
    setPaying(planId);
    try {
      // Preferred path: real Stripe Checkout when the key is configured.
      const res: any = await createCheckout({ planId: planId as any });
      window.location.href = res.url;
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.includes("STRIPE_SECRET_KEY")) {
        // Stripe not configured yet → fall back to direct activation (demo mode).
        try {
          await subscribe({ planId: planId as any });
          toast.success(
            lang === "ar"
              ? "تم تفعيل الاشتراك (وضع تجريبي — لم يُربط الدفع بعد)"
              : "Subscribed (demo mode — payment not wired yet)",
          );
        } catch (e2: any) {
          toast.error(e2.message ?? "خطأ");
        }
      } else {
        toast.error(msg || "خطأ");
      }
    } finally {
      setPaying(null);
    }
  };

  const handleCancel = async () => {
    try {
      await cancelSub({});
      toast.success(lang === "ar" ? "تم إلغاء الاشتراك" : "Subscription cancelled");
    } catch (e: any) {
      toast.error(e.message ?? "خطأ");
    }
  };

  const currentPlanId = (mySub?.plan as any)?._id;

  return (
    <div className="py-10">
      <SEO
        title={`${t("subscriptions")} | حكي`}
        description={lang === "ar" ? "اختر باقة حكي المناسبة لك واستمتع بكل المحتوى بلا حدود." : "Choose your HAKI plan and enjoy all content."}
      />
      <div className="haki-container">
        <div className="text-center">
          <h1 className="text-3xl font-black sm:text-4xl">{t("subscriptions")}</h1>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            {lang === "ar"
              ? "باقات مصممة لتناسب كل مستمع — اختر ما يناسبك واستمتع بتجربة بلا حدود."
              : "Plans for every listener — pick yours and enjoy unlimited access."}
          </p>
        </div>

        {/* Current subscription banner */}
        {mySub?.plan && (
          <div className="mx-auto mt-8 flex max-w-lg items-center justify-between rounded-2xl border bg-accent/60 p-4">
            <div className="flex items-center gap-3">
              <Crown className="size-5 text-primary" />
              <div>
                <p className="text-sm font-bold">
                  {lang === "ar" ? "اشتراكك الحالي: " : "Your plan: "}
                  {(mySub.plan as any).name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {lang === "ar" ? "ينتهي في " : "Expires "}
                  {new Date(mySub.expiresAt).toLocaleDateString(lang === "ar" ? "ar" : "en")}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleCancel} className="text-destructive">
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </Button>
          </div>
        )}

        {/* Plans */}
        {plans === undefined ? (
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-96 rounded-3xl" />
            ))}
          </div>
        ) : (
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {plans.map((plan) => {
              const isCurrent = currentPlanId === plan._id;
              const features = lang === "ar" ? plan.features : (plan.featuresEn ?? plan.features);
              return (
                <div
                  key={plan._id}
                  className={cn(
                    "relative flex flex-col rounded-3xl border bg-card p-7 transition-all card-shadow",
                    plan.isPopular && "border-primary shadow-lg shadow-primary/10",
                  )}
                >
                  {plan.isPopular && (
                    <Badge className="absolute -top-3 start-1/2 -translate-x-1/2 bg-primary px-3 py-1 text-white rtl:translate-x-1/2">
                      <Sparkles className="size-3" />
                      {lang === "ar" ? "الأكثر شيوعًا" : "Most popular"}
                    </Badge>
                  )}
                  <h2 className="text-lg font-extrabold">{lang === "ar" ? plan.name : plan.nameEn}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                  <div className="mt-5 flex items-baseline gap-1.5">
                    <span className="text-4xl font-black">{plan.price === 0 ? (lang === "ar" ? "مجانًا" : "Free") : plan.price}</span>
                    {plan.price > 0 && (
                      <span className="text-sm font-semibold text-muted-foreground">
                        {plan.currency} / {plan.period === "monthly" ? (lang === "ar" ? "شهريًا" : "month") : (lang === "ar" ? "سنويًا" : "year")}
                      </span>
                    )}
                  </div>
                  <ul className="mt-6 flex-1 space-y-2.5">
                    {features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span className="text-muted-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={cn("mt-7 w-full font-bold", isCurrent && "opacity-60")}
                    variant={plan.isPopular ? "default" : "outline"}
                    disabled={isCurrent || paying !== null}
                    onClick={() => handleSubscribe(plan._id)}
                  >
                    {paying === plan._id
                      ? "…"
                      : isCurrent
                        ? t("currentPlanBadge")
                        : t("choosePlan")}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          {lang === "ar"
            ? "الدفع يُدار عبر بوابة الدفع — البنية جاهزة للربط مع مزود المدفوعات."
            : "Payments are handled via a gateway — architecture is ready for a payment provider."}
        </p>
      </div>
    </div>
  );
}
