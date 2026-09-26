import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useMutation, useQuery } from "convex/react";
import { Banknote, CreditCard, Landmark, Wallet } from "lucide-react";
import { toast } from "sonner";

const METHODS = [
  { key: "stripe" as const, icon: CreditCard, ar: "Stripe — بطاقات إلكترونية", en: "Stripe — cards", descAr: "الدفع بالبطاقات عبر Stripe Checkout", descEn: "Card payments via Stripe Checkout" },
  { key: "bankTransfer" as const, icon: Landmark, ar: "تحويل بنكي", en: "Bank transfer", descAr: "تحويل مباشر إلى حساب المنصة", descEn: "Direct transfer to the platform account" },
  { key: "cod" as const, icon: Banknote, ar: "الدفع عند الاستلام", en: "Cash on delivery", descAr: "مناسب للمنتجات المادية", descEn: "For physical goods" },
];

export function PaymentMethodsManager({
  L,
}: {
  L: (ar: string, en: string) => string;
}) {
  const config = useQuery(api.paymentMethods.getAdmin, {});
  const setMethods = useMutation(api.paymentMethods.setMethods);

  const toggle = async (key: "stripe" | "bankTransfer" | "cod", value: boolean) => {
    if (!config) return;
    try {
      await setMethods({
        stripe: key === "stripe" ? value : config.stripe,
        bankTransfer: key === "bankTransfer" ? value : config.bankTransfer,
        cod: key === "cod" ? value : config.cod,
      });
      toast.success(L("تم الحفظ", "Saved"));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-black">
          <Wallet className="size-5 text-primary" />
          {L("وسائل الدفع", "Payment methods")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {L("فعّل الوسائل المتاحة للمشتركين عند الدفع.", "Enable the methods available to subscribers at checkout.")}
        </p>
      </div>

      {config === undefined ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : (
        <div className="space-y-3">
          {METHODS.map((m) => (
            <div
              key={m.key}
              className="flex items-center justify-between gap-4 rounded-2xl border bg-card p-5 card-shadow"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent">
                  <m.icon className="size-5 text-accent-foreground" />
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-extrabold">
                    {L(m.ar, m.en)}
                    {config[m.key] && (
                      <Badge className="bg-green-600 text-white">{L("مفعّل", "On")}</Badge>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{L(m.descAr, m.descEn)}</p>
                </div>
              </div>
              <Switch
                checked={config[m.key]}
                onCheckedChange={(v) => toggle(m.key, v)}
                aria-label={L(m.ar, m.en)}
              />
            </div>
          ))}
        </div>
      )}

      <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
        {L(
          "ملاحظة: تفعيل Stripe يتطلب إضافة STRIPE_SECRET_KEY من تبويب المفاتيح. بدون المفتاح يعمل الدفع بوضع تجريبي.",
          "Note: Stripe requires STRIPE_SECRET_KEY in the Keys tab. Without it, checkout runs in demo mode.",
        )}
      </p>
    </div>
  );
}
