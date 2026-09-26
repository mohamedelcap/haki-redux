import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQuery } from "convex/react";
import {
  Calculator,
  Coins,
  FileSpreadsheet,
  Handshake,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function RoyaltiesManager({
  L,
}: {
  L: (ar: string, en: string) => string;
}) {
  const publishers = useQuery(api.content.listPublishers, {});
  const contracts = useQuery(api.royalties.listContracts, {});
  const pools = useQuery(api.royalties.listPools, {});
  const createContract = useMutation(api.royalties.createContract);
  const deleteContract = useMutation(api.royalties.deleteContract);
  const setContractActive = useMutation(api.royalties.setContractActive);
  const createPool = useMutation(api.royalties.createPool);
  const deletePool = useMutation(api.royalties.deletePool);
  const calculate = useMutation(api.royalties.calculateDistribution);

  const [selectedPool, setSelectedPool] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // contract form
  const [cPublisher, setCPublisher] = useState("");
  const [cPct, setCPct] = useState("70");
  const [cStart, setCStart] = useState("");
  const [cNotes, setCNotes] = useState("");
  const hakiPct = Math.round((100 - (parseFloat(cPct) || 0)) * 100) / 100;
  const pctValid = hakiPct >= 0 && hakiPct <= 100 && parseFloat(cPct) > 0;

  // pool form
  const [pName, setPName] = useState("");
  const [pAmount, setPAmount] = useState("");
  const [pFrom, setPFrom] = useState("");
  const [pTo, setPTo] = useState("");

  const statements = useQuery(
    api.royalties.listStatements,
    selectedPool ? { poolId: selectedPool as never } : "skip",
  );
  const summary = useQuery(
    api.royalties.poolSummary,
    selectedPool ? { poolId: selectedPool as never } : "skip",
  );

  const submitContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cPublisher) return;
    setBusy(true);
    try {
      await createContract({
        publisherId: cPublisher as never,
        publisherPercentage: parseFloat(cPct),
        hakiPercentage: hakiPct,
        startDate: cStart || new Date().toISOString().slice(0, 10),
        notes: cNotes || undefined,
      });
      toast.success(L("تم إنشاء العقد", "Contract created"));
      setCPublisher("");
      setCPct("70");
      setCNotes("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitPool = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const id = await createPool({
        name: pName,
        totalAmount: parseFloat(pAmount),
        currency: "EGP",
        periodStart: pFrom,
        periodEnd: pTo,
      });
      toast.success(L("تم إنشاء الصندوق", "Pool created"));
      setSelectedPool(id);
      setPName("");
      setPAmount("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const runCalc = async (poolId: string) => {
    setBusy(true);
    try {
      const res = await calculate({ poolId: poolId as never });
      toast.success(
        L(
          `تم الحساب — ${res.publishers} دار نشر، ${Math.round(res.totalListenedSeconds / 3600)} ساعة استماع`,
          `Done — ${res.publishers} publishers, ${Math.round(res.totalListenedSeconds / 3600)} listen hours`,
        ),
      );
      setSelectedPool(poolId);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const fmt = (n: number) => n.toLocaleString("en", { maximumFractionDigits: 2 });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-black">
          <Coins className="size-5 text-primary" />
          {L("توزيع الأرباح", "Revenue distribution")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {L(
            "نصيب دار النشر = صندوق الإيرادات × حصة استخدام أعمالها × نسبة العقد — يُحسب تلقائيًا من سجل الاستماع الفعلي.",
            "Publisher share = revenue pool × usage share × contract rate — computed from real listening history.",
          )}
        </p>
        <div className="mt-3 rounded-xl bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
          <p className="font-bold text-foreground">{L("مثال", "Example")}:</p>
          {L(
            "صندوق 1,000,000 ج.م · حصة استخدام الدار 10% → إجمالي أعمال الدار 100,000 ج.م · عقد 70/30 → الدار 70,000 ج.م وحكي 30,000 ج.م.",
            "Pool 1,000,000 EGP · publisher usage 10% → gross 100,000 EGP · 70/30 contract → publisher 70,000 and HAKI 30,000.",
          )}
        </div>
      </div>

      {/* Contracts */}
      <section className="rounded-2xl border bg-card p-5 card-shadow">
        <h3 className="flex items-center gap-2 font-black">
          <Handshake className="size-4 text-primary" />
          {L("عقود دور النشر", "Publishing contracts")}
        </h3>
        <form onSubmit={submitContract} className="mt-4 grid gap-3 sm:grid-cols-[1fr_130px_110px_1fr_auto]">
          <div className="space-y-1.5">
            <Label>{L("دار النشر", "Publisher")}</Label>
            <Select value={cPublisher} onValueChange={setCPublisher}>
              <SelectTrigger><SelectValue placeholder={L("اختر دارًا", "Select publisher")} /></SelectTrigger>
              <SelectContent>
                {(publishers ?? []).map((p: any) => (
                  <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{L("نسبة الدار %", "Publisher %")}</Label>
            <Input
              type="number" min={1} max={99} step="0.1" value={cPct}
              onChange={(e) => setCPct(e.target.value)} dir="ltr"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{L("نسبة حكي %", "HAKI %")}</Label>
            <div className="flex h-9 items-center rounded-md border px-3">
              <span className={pctValid ? "text-sm font-bold text-primary" : "text-sm font-bold text-destructive"} dir="ltr">
                {hakiPct}%
              </span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{L("تاريخ البدء", "Start date")}</Label>
            <Input type="date" value={cStart} onChange={(e) => setCStart(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button type="submit" className="font-bold" disabled={busy || !pctValid || !cPublisher}>
              <Plus className="size-4" />
              {L("عقد", "Add")}
            </Button>
          </div>
        </form>
        {!pctValid && (
          <p className="mt-2 text-xs font-semibold text-destructive">
            {L("نسبة الدار + نسبة حكي يجب أن تساوي 100%", "Publisher % + HAKI % must equal 100%")}
          </p>
        )}

        <div className="mt-4 space-y-2">
          {contracts === undefined ? (
            <Skeleton className="h-16 rounded-xl" />
          ) : contracts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{L("لا عقود بعد — أنشئ أول عقد بالأعلى", "No contracts yet")}</p>
          ) : (
            contracts.map((c: any) => (
              <div key={c._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3">
                <div className="min-w-0">
                  <p className="font-bold">{c.publisherName}</p>
                  <p className="text-xs text-muted-foreground" dir="ltr">
                    {c.startDate}{c.endDate ? ` → ${c.endDate}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-primary text-white">{c.publisherPercentage}% {L("للدار", "publisher")}</Badge>
                  <Badge variant="secondary">{c.hakiPercentage}% {L("لحكي", "HAKI")}</Badge>
                  {c.isActive ? (
                    <Button variant="ghost" size="sm" onClick={() => setContractActive({ id: c._id, isActive: false })}>
                      {L("إيقاف", "Deactivate")}
                    </Button>
                  ) : (
                    <>
                      <Badge variant="outline">{L("موقوف", "Inactive")}</Badge>
                      <Button variant="ghost" size="sm" onClick={() => setContractActive({ id: c._id, isActive: true })}>
                        {L("تفعيل", "Activate")}
                      </Button>
                    </>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => deleteContract({ id: c._id })}>
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Pools */}
      <section className="rounded-2xl border bg-card p-5 card-shadow">
        <h3 className="flex items-center gap-2 font-black">
          <FileSpreadsheet className="size-4 text-primary" />
          {L("صناديق الإيرادات", "Revenue pools")}
        </h3>
        <form onSubmit={submitPool} className="mt-4 grid gap-3 sm:grid-cols-[1fr_150px_145px_145px_auto]">
          <div className="space-y-1.5">
            <Label>{L("اسم الصندوق", "Pool name")}</Label>
            <Input value={pName} onChange={(e) => setPName(e.target.value)} required
              placeholder={L("إيرادات سبتمبر 2026", "September 2026 revenue")} />
          </div>
          <div className="space-y-1.5">
            <Label>{L("المبلغ (ج.م)", "Amount (EGP)")}</Label>
            <Input type="number" min={1} value={pAmount} onChange={(e) => setPAmount(e.target.value)} required dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <Label>{L("من", "From")}</Label>
            <Input type="date" value={pFrom} onChange={(e) => setPFrom(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>{L("إلى", "To")}</Label>
            <Input type="date" value={pTo} onChange={(e) => setPTo(e.target.value)} required />
          </div>
          <div className="flex items-end">
            <Button type="submit" className="font-bold" disabled={busy}>
              <Plus className="size-4" />
              {L("إنشاء", "Create")}
            </Button>
          </div>
        </form>

        <div className="mt-4 space-y-2">
          {pools === undefined ? (
            <Skeleton className="h-16 rounded-xl" />
          ) : pools.length === 0 ? (
            <p className="text-sm text-muted-foreground">{L("لا صناديق بعد", "No pools yet")}</p>
          ) : (
            pools.map((p: any) => (
              <div
                key={p._id}
                className={
                  "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 " +
                  (selectedPool === p._id ? "border-primary/50 bg-primary/5" : "")
                }
              >
                <button type="button" className="min-w-0 text-start" onClick={() => setSelectedPool(p._id)}>
                  <p className="font-bold">{p.name}</p>
                  <p className="text-xs text-muted-foreground" dir="ltr">
                    {fmt(p.totalAmount)} {p.currency} · {p.periodStart} → {p.periodEnd}
                  </p>
                </button>
                <div className="flex items-center gap-2">
                  <Badge variant={p.status === "settled" ? "secondary" : p.status === "calculated" ? "default" : "outline"}>
                    {p.status === "calculated" ? L("محسوب", "Calculated") : p.status === "settled" ? L("مسوّى", "Settled") : L("مسودة", "Draft")}
                  </Badge>
                  <Button size="sm" className="font-bold" disabled={busy || p.status === "settled"} onClick={() => runCalc(p._id)}>
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <Calculator className="size-4" />}
                    {L("احسب التوزيع", "Calculate")}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deletePool({ id: p._id })}>
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Statements */}
      {selectedPool && summary && (
        <section className="rounded-2xl border bg-card p-5 card-shadow">
          <h3 className="font-black">{L("كشف التوزيع", "Distribution statement")}</h3>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border p-3 text-center">
              <p className="text-lg font-black tabular-nums text-primary">{fmt(summary.publisherTotal)}</p>
              <p className="text-[11px] text-muted-foreground">{L("إجمالي دور النشر", "Publishers total")}</p>
            </div>
            <div className="rounded-xl border p-3 text-center">
              <p className="text-lg font-black tabular-nums">{fmt(summary.hakiTotal)}</p>
              <p className="text-[11px] text-muted-foreground">{L("نصيب حكي", "HAKI total")}</p>
            </div>
            <div className="rounded-xl border p-3 text-center">
              <p className="text-lg font-black tabular-nums">{summary.publishers}</p>
              <p className="text-[11px] text-muted-foreground">{L("عدد دور النشر", "Publishers")}</p>
            </div>
            <div className="rounded-xl border p-3 text-center">
              <p className="text-lg font-black tabular-nums">{summary.withContract}</p>
              <p className="text-[11px] text-muted-foreground">{L("بعقود سارية", "With contract")}</p>
            </div>
          </div>

          {statements === undefined ? (
            <Skeleton className="mt-4 h-40 rounded-xl" />
          ) : statements.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">{L("اضغط احسب التوزيع لعرض الكشف", "Press Calculate to build the statement")}</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="p-3 text-start font-semibold">{L("دار النشر", "Publisher")}</th>
                    <th className="p-3 text-start font-semibold">{L("ثواني الاستماع", "Listen seconds")}</th>
                    <th className="p-3 text-start font-semibold">{L("حصة الاستخدام", "Usage share")}</th>
                    <th className="p-3 text-start font-semibold">{L("إجمالي أعمال الدار", "Gross")}</th>
                    <th className="p-3 text-start font-semibold">{L("العقد", "Contract")}</th>
                    <th className="p-3 text-start font-semibold">{L("نصيب الدار", "Publisher")}</th>
                    <th className="p-3 text-start font-semibold">{L("نصيب حكي", "HAKI")}</th>
                  </tr>
                </thead>
                <tbody>
                  {statements.map((s: any) => (
                    <tr key={s._id} className="border-b last:border-0">
                      <td className="p-3 font-bold">
                        {s.publisherName}
                        {!s.hasContract && (
                          <Badge variant="outline" className="ms-2 text-[10px]">{L("بلا عقد", "No contract")}</Badge>
                        )}
                      </td>
                      <td className="p-3 tabular-nums text-muted-foreground" dir="ltr">{fmt(s.usageSeconds)}</td>
                      <td className="p-3 tabular-nums" dir="ltr">{s.usageShare}%</td>
                      <td className="p-3 tabular-nums" dir="ltr">{fmt(s.grossAmount)}</td>
                      <td className="p-3 text-xs" dir="ltr">{s.publisherPercentage} / {s.hakiPercentage}</td>
                      <td className="p-3 font-black tabular-nums text-primary" dir="ltr">{fmt(s.publisherAmount)}</td>
                      <td className="p-3 tabular-nums" dir="ltr">{fmt(s.hakiAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
