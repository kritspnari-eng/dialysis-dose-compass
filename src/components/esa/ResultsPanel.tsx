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
  isIronDeficient,
  missingLookupMessage,
  type CostSummary,
  type DialysisPattern,
  type Plan,
  type Recommendation,
} from "@/lib/esa/calc";
import type { Drug, PatientInput } from "@/lib/esa/data";

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
          กรอกข้อมูลผู้ป่วย หรือกดโหลดเคสตัวอย่าง แล้วกด “คำนวณแผนการให้ยา”
        </p>
      </div>
    </div>
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
            <p className="text-sm font-medium text-muted-foreground">ขนาดยาที่แนะนำต่อสัปดาห์</p>
            <p className="font-num text-5xl font-bold leading-none text-primary sm:text-6xl">
              {fmt(dose)}
              <span className="ml-2 text-xl font-semibold text-muted-foreground">IU/wk</span>
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge variant={overridden ? "ineligible" : "mint"}>
                {overridden ? "ปรับเองโดยผู้สั่งยา" : ACTION_LABEL[rec.action]}
              </Badge>
              <Badge variant="sky">
                {drug.Brand_Name} {fmt(drug.Strength_IU)} IU · {drug.Dosage_Form} · {input.Route}
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

      {isIronDeficient(input) && (
        <div className="flex items-start gap-3 rounded-xl border border-caution-border bg-caution-surface p-4 text-sm text-caution-foreground">
          <Droplets className="mt-0.5 size-5 shrink-0" />
          <p>
            <strong>ผู้ป่วยมีภาวะพร่องธาตุเหล็ก</strong> (TSAT &lt; 20% หรือ Ferritin &lt; 200 ng/mL)
            ควรพิจารณาให้ธาตุเหล็กเสริมควบคู่กับการปรับยา ESA
            <span className="mt-1 block text-xs opacity-80">
              TSAT {input.TSAT_Percent}% · Ferritin {input.Ferritin_ng_mL} ng/mL
            </span>
          </p>
        </div>
      )}

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
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">รายการ</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">ต่อสัปดาห์</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">ต่อเดือน</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className="px-4 py-3">ค่ายาทั้งหมด (ราคา รพ.)</td>
                  <td className="px-4 py-3 text-right font-num">{fmt(cost.week.total)}</td>
                  <td className="px-4 py-3 text-right font-num">{fmt(cost.month.total)}</td>
                </tr>
                <tr className="border-t">
                  <td className="px-4 py-3">เบิกตามสิทธิได้</td>
                  <td className="px-4 py-3 text-right font-num text-success">{fmt(cost.week.reimbursed)}</td>
                  <td className="px-4 py-3 text-right font-num text-success">{fmt(cost.month.reimbursed)}</td>
                </tr>
                <tr className="border-t bg-warning-surface text-warning-foreground">
                  <td className="px-4 py-3 font-semibold">ผู้ป่วยชำระส่วนต่างเพิ่ม</td>
                  <td className="px-4 py-3 text-right font-num text-lg font-bold">{fmt(cost.week.copay)}</td>
                  <td className="px-4 py-3 text-right font-num text-lg font-bold">{fmt(cost.month.copay)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            หน่วย: บาท · ส่วนต่าง = max(0, ราคา รพ. − เพดานเบิก) × จำนวนหน่วย
            {cost.capAboveHospPrice && " · เพดานเบิกสูงกว่าราคา รพ. จึงไม่มีส่วนต่าง"}
          </p>
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
