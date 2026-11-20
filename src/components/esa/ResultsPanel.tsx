import {
  AlertTriangle,
  CalendarRange,
  ClipboardCopy,
  Droplets,
  Minus,
  Plus,
  RotateCcw,
  Stethoscope,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MonthlySummaryTable } from "@/components/esa/MonthlySummaryTable";
import { PatternPicker, WeeklyScheduleTable } from "@/components/esa/WeeklyScheduleTable";
import {
  ACTION_LABEL,
  fmt,
  ironAssessment,
  missingLookupMessage,
  type CostSummary,
  type DialysisPattern,
  type IronStatus,
  type Plan,
  type Recommendation,
} from "@/lib/esa/calc";
import type { Drug, PatientInput } from "@/lib/esa/data";
import { cn } from "@/lib/utils";

function Card({
  icon,
  title,
  aside,
  children,
}: {
  icon: ReactNode;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <span className="grid size-8 place-items-center rounded-lg bg-sky text-sky-foreground [&_svg]:size-4">
            {icon}
          </span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function EmptyResults() {
  return (
    <div className="panel grid min-h-[420px] place-items-center p-10 text-center">
      <div className="max-w-sm space-y-3">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-mint text-mint-foreground">
          <CalendarRange className="size-7" />
        </div>
        <h2 className="text-xl font-semibold">แผนการให้ยาจะแสดงที่นี่</h2>
        <p className="text-sm text-muted-foreground">
          กรอกข้อมูลผู้ป่วย แล้วกด “คำนวณแผนการให้ยา”
        </p>
      </div>
    </div>
  );
}

const IRON_STYLE: Record<IronStatus, { box: string; badge: "ineligible" | "caution" | "eligible" | "secondary" }> = {
  unknown: {
    box: "border-border bg-muted text-muted-foreground",
    badge: "secondary",
  },
  deficient: {
    box: "border-warning-border bg-warning-surface text-warning-foreground",
    badge: "ineligible",
  },
  high: {
    box: "border-caution-border bg-caution-surface text-caution-foreground",
    badge: "caution",
  },
  adequate: {
    box: "border-success/40 bg-success-surface text-success",
    badge: "eligible",
  },
};

function IronStatusCard({ input }: { input: PatientInput }) {
  const iron = ironAssessment(input);
  const style = IRON_STYLE[iron.status];
  return (
    <section className={`space-y-2 rounded-xl border p-4 text-sm ${style.box}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Droplets className="size-5 shrink-0" />
        <h2 className="font-semibold">การประเมินสถานะธาตุเหล็ก (Iron Status)</h2>
        <Badge variant={style.badge}>{iron.title}</Badge>
      </div>
      <p>{iron.advice}</p>
      <p className="text-xs opacity-80">
        TSAT {input.TSAT_Percent === null ? "ไม่มีข้อมูล" : `${fmt(input.TSAT_Percent)}%`} · Ferritin{" "}
        {input.Ferritin_ng_mL === null ? "ไม่มีข้อมูล" : `${fmt(input.Ferritin_ng_mL)} ng/mL`}
      </p>
    </section>
  );
}

function LabelCell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <td className={cn("px-2 py-3 break-words text-[0.8rem] sm:px-4 sm:text-sm", className)}>{children}</td>
  );
}

function MoneyCell({ value, className }: { value: number; className?: string }) {
  return (
    <td
      className={cn(
        "px-2 py-3 text-right font-num whitespace-nowrap text-[0.8rem] sm:px-4 sm:text-sm",
        className,
      )}
    >
      {fmt(value)}
      <span className="ml-1 text-[0.72em] font-medium opacity-80">บาท</span>
    </td>
  );
}

export function ResultsPanel({
  input,
  drug,
  rec,
  dose,
  overridden,
  onStep,
  onReset,
  pattern,
  onPattern,
  plan,
  cost,
  note,
}: {
  input: PatientInput;
  drug: Drug;
  rec: Recommendation;
  dose: number;
  overridden: boolean;
  onStep: (dir: 1 | -1) => void;
  onReset: () => void;
  pattern: DialysisPattern;
  onPattern: (id: string) => void;
  plan: Plan | null;
  cost: CostSummary | null;
  note: string;
}) {
  const perKg = input.Dry_Weight_kg > 0 ? Math.round(dose / input.Dry_Weight_kg) : null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(note);
      toast.success("คัดลอกสรุปคำสั่งยาแล้ว", { description: "วางในระบบเวชระเบียนได้ทันที" });
    } catch {
      toast.error("คัดลอกไม่สำเร็จ กรุณาเลือกข้อความด้านล่างแล้วคัดลอกเอง");
    }
  };

  return (
    <div className="space-y-5">
      {/* Dose */}
      <section className="panel overflow-hidden">
        <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-end sm:p-6">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              ขนาดยาที่แนะนำต่อสัปดาห์{plan?.alternating ? " (เฉลี่ย · ฉีดสลับสัปดาห์)" : ""}
            </p>
            <p className="font-num text-5xl font-bold leading-none text-primary sm:text-6xl">
              {fmt(dose)}
              <span className="ml-2 text-xl font-semibold text-muted-foreground">IU/wk</span>
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge variant={overridden ? "ineligible" : "mint"}>
                {overridden ? "ปรับเองโดยผู้สั่งยา" : ACTION_LABEL[rec.action]}
              </Badge>
              <Badge variant="sky">
                {drug.Brand_Name} {fmt(drug.Strength_IU)} IU · {drug.Dosage_Form} · Route: {input.Route}
              </Badge>
              {perKg !== null && <span className="text-xs text-muted-foreground">≈ {perKg} IU/kg/wk</span>}
            </div>
            <p className="text-sm text-muted-foreground">{rec.reason}</p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <p className="text-xs text-muted-foreground">ปรับขนาดยาเอง</p>
            <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
              <Button type="button" variant="ghost" size="icon" aria-label="ลดขนาดยา" onClick={() => onStep(-1)}>
                <Minus />
              </Button>
              <span className="min-w-20 text-center font-num text-sm font-semibold">
                {drug.Dosage_Form === "PFS" ? `±${fmt(drug.Strength_IU)}` : "ขั้นถัดไป"}
              </span>
              <Button type="button" variant="ghost" size="icon" aria-label="เพิ่มขนาดยา" onClick={() => onStep(1)}>
                <Plus />
              </Button>
            </div>
            {overridden && (
              <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={onReset}>
                <RotateCcw /> กลับไปใช้ {fmt(rec.dose)} IU
              </Button>
            )}
          </div>
        </div>
      </section>

      <IronStatusCard input={input} />

      {/* Weekly */}
      <Card icon={<CalendarRange />} title="ตารางกระจายการฉีดยารายสัปดาห์">
        <PatternPicker freq={input.Dialysis_Freq} pattern={pattern} onChange={onPattern} />
        {plan ? (
          <WeeklyScheduleTable plan={plan} pattern={pattern} drug={drug} dose={dose} />
        ) : (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-warning-border bg-warning-surface p-4 text-sm font-medium text-warning-foreground"
          >
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" />
            <p>
              {missingLookupMessage(input.Dialysis_Freq)}
              <span className="mt-1 block text-xs font-normal opacity-80">
                ขนาดยา {fmt(dose)} IU · {drug.Dosage_Form} · ใช้ปุ่ม +/− ด้านบนเพื่อเลือกขนาดยาที่มีสูตรรองรับ
              </span>
            </p>
          </div>
        )}
      </Card>

      {/* Monthly */}
      {plan && (
        <Card icon={<Stethoscope />} title="สรุปแผนรายเดือน (สัปดาห์ที่ 1–4)">
          <MonthlySummaryTable plan={plan} drug={drug} />
        </Card>
      )}

      {/* Cost */}
      {cost && (
        <Card
          icon={<Wallet />}
          title="ค่าใช้จ่ายตามสิทธิ"
          aside={
            <Badge variant={cost.eligible ? "eligible" : "ineligible"}>
              {cost.eligible ? `เบิกได้ · เพดาน ${fmt(cost.cap)} บาท/หน่วย` : `เบิกไม่ได้ตามสิทธิ ${input.Patient_Right}`}
            </Badge>
          }
        >
          <div className="rounded-xl border">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-[42%]" />
                <col className="w-[29%]" />
                <col className="w-[29%]" />
              </colgroup>
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-2 py-3 text-left font-semibold sm:px-4">
                    รายการ
                  </th>
                  <th scope="col" className="px-2 py-3 text-right font-semibold sm:px-4">
                    ต่อสัปดาห์
                    {plan?.alternating && (
                      <span className="block text-[10px] font-medium opacity-80">(เฉลี่ย)</span>
                    )}
                  </th>
                  <th scope="col" className="px-2 py-3 text-right font-semibold sm:px-4">
                    รวม 1 เดือน
                    <span className="block text-[10px] font-medium opacity-80">(4 สัปดาห์)</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <LabelCell>ค่ายาทั้งหมด (ราคา รพ.)</LabelCell>
                  <MoneyCell value={cost.week.total} />
                  <MoneyCell value={cost.month.total} />
                </tr>
                <tr className="border-t">
                  <LabelCell>เบิกตามสิทธิได้</LabelCell>
                  <MoneyCell value={cost.week.reimbursed} className="text-success" />
                  <MoneyCell value={cost.month.reimbursed} className="text-success" />
                </tr>
                <tr className="border-t bg-warning-surface text-warning-foreground">
                  <LabelCell className="font-semibold">ผู้ป่วยชำระส่วนต่างเพิ่ม</LabelCell>
                  <MoneyCell value={cost.week.copay} className="text-base font-bold sm:text-lg" />
                  <MoneyCell value={cost.month.copay} className="text-base font-bold sm:text-lg" />
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Copy note */}
      <section className="panel space-y-3 p-5 sm:p-6">
        <Button type="button" variant="mint" size="xl" className="w-full" onClick={copy}>
          <ClipboardCopy /> คัดลอกสรุปคำสั่งยา (Copy Note)
        </Button>
        <details className="group">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            ดูตัวอย่างข้อความที่จะคัดลอก
          </summary>
          <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-4 font-sans text-xs leading-relaxed">
            {note}
          </pre>
        </details>
      </section>
    </div>
  );
}
