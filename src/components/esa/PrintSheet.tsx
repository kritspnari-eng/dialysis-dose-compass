import type { ReactNode } from "react";

import {
  DAY_SHORT,
  WEEK_DAYS,
  fmt,
  freqCount,
  missingLookupMessage,
  patternLabel,
  unitName,
  type DialysisPattern,
  type Plan,
  type WeekSchedule,
} from "@/lib/esa/calc";
import { RIGHT_LABELS, type Drug, type PatientInput } from "@/lib/esa/data";
import { cn } from "@/lib/utils";

const MONTHS = [1, 2, 3, 4, 5, 6] as const;
const WEEKS = [1, 2, 3, 4] as const;

/** Dotted line to write on with a pen; shows the value instead when one is given. */
function Fill({ value, width = "w-[13mm]" }: { value?: string | undefined; width?: string }) {
  return (
    <span
      className={cn(
        "inline-block border-b border-dotted border-foreground/60 text-center align-bottom font-num font-bold leading-tight",
        width,
      )}
    >
      {value ?? "\u00a0"}
    </span>
  );
}

function Cell({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <td className={cn("h-[11.5mm] border border-foreground/50 px-[0.5mm] text-center align-middle leading-[1.1]", className)}>
      {children}
    </td>
  );
}

function MonthBlock({
  month,
  input,
  drug,
  dose,
  pattern,
  plan,
}: {
  month: number;
  input: PatientInput;
  drug: Drug;
  dose: number;
  pattern: DialysisPattern;
  plan: Plan | null;
}) {
  const unit = unitName(drug.Dosage_Form);
  const filled = month === 1;
  const scheduleFor = (week: number): WeekSchedule | undefined =>
    plan?.variants.find((v) => v.weeks.includes(week))?.schedule;

  return (
    <section className="flex flex-col gap-[1.2mm] rounded-[1.5mm] border border-foreground/70 p-[2mm] text-[7.5pt]">
      <div className="flex items-baseline justify-between gap-[2mm]">
        <span className="rounded-[1mm] bg-sky px-[1.5mm] py-[0.3mm] text-[8pt] font-bold text-sky-foreground">
          เดือนที่ {month}
        </span>
        <span>
          เดือน: <Fill width="w-[22mm]" />
        </span>
        <span>
          วันที่: <Fill width="w-[18mm]" />
        </span>
      </div>
      <div className="flex flex-wrap justify-between gap-x-[2mm] gap-y-[0.8mm]">
        <span>
          Hb เดิม <Fill width="w-[10mm]" /> → Hb ใหม่{" "}
          <Fill width="w-[10mm]" value={filled ? fmt(input.Current_Hb) : undefined} /> g/dL
        </span>
        <span>
          EPO เดิม <Fill width="w-[13mm]" value={filled ? fmt(input.Prev_Weekly_Dose_IU) : undefined} /> → EPO ใหม่{" "}
          <Fill width="w-[13mm]" value={filled ? fmt(dose) : undefined} /> IU/wk
        </span>
      </div>

      <table className="w-full table-fixed border-collapse text-[7pt]">
        <colgroup>
          <col className="w-[16%]" />
          {WEEK_DAYS.map((d) => (
            <col key={d} className="w-[11%]" />
          ))}
          <col className="w-[18%]" />
        </colgroup>
        <thead>
          <tr className="bg-muted">
            <th className="border border-foreground/50 py-[0.6mm] font-semibold">สัปดาห์</th>
            {WEEK_DAYS.map((d) => (
              <th key={d} className="border border-foreground/50 py-[0.6mm] font-semibold">
                {DAY_SHORT[d]}
              </th>
            ))}
            <th className="border border-foreground/50 py-[0.6mm] font-semibold">รวม</th>
          </tr>
        </thead>
        <tbody>
          {WEEKS.map((week) => {
            const schedule = filled ? scheduleFor(week) : undefined;
            const row = filled ? plan?.months.find((m) => m.week === week) : undefined;
            return (
              <tr key={week}>
                <th scope="row" className="border border-foreground/50 bg-muted px-[0.5mm] text-[6.8pt] font-semibold">
                  สัปดาห์ที่ {week}
                </th>
                {WEEK_DAYS.map((d) => {
                  if (!schedule) return <Cell key={d} />;
                  const iu = schedule[d];
                  if (iu) {
                    return (
                      <Cell key={d} className="bg-mint text-mint-foreground">
                        <span className="block font-num font-bold">{fmt(iu)}</span>
                        <span className="block text-[6pt]">
                          {fmt(Math.round((iu / drug.Strength_IU) * 100) / 100)} {unit}
                        </span>
                      </Cell>
                    );
                  }
                  return (
                    <Cell key={d} className="text-muted-foreground">
                      {pattern.days.includes(d) ? "งด" : "-"}
                    </Cell>
                  );
                })}
                <Cell className="font-semibold">
                  {row && (
                    <>
                      <span className="block font-num font-bold">{fmt(row.dose)} IU</span>
                      <span className="block text-[6pt]">
                        {fmt(row.units)} {unit}
                      </span>
                    </>
                  )}
                </Cell>
              </tr>
            );
          })}
        </tbody>
      </table>
      {filled && !plan && (
        <p className="text-[6.5pt] font-semibold text-warning-foreground">{missingLookupMessage(input.Dialysis_Freq)}</p>
      )}
    </section>
  );
}

/** One A4 portrait page: 6-month ESA follow-up sheet. Only visible when printing. */
export function PrintSheet({
  input,
  drug,
  dose,
  pattern,
  plan,
}: {
  input: PatientInput;
  drug: Drug;
  dose: number;
  pattern: DialysisPattern;
  plan: Plan | null;
}) {
  return (
    <div className="hidden h-[279mm] w-[194mm] flex-col gap-[2.5mm] overflow-hidden bg-card text-foreground print:flex">
      <header className="space-y-[1.2mm] border-b-2 border-foreground/80 pb-[2mm]">
        <h1 className="text-center text-[13pt] font-bold">ใบติดตามแผนการให้ยา ESAs (6 เดือน) - หน่วยไตเทียม</h1>
        <div className="flex flex-wrap justify-between gap-x-[4mm] gap-y-[1mm] text-[8.5pt]">
          <span>
            ชื่อ-สกุล <Fill width="w-[48mm]" />
          </span>
          <span>
            HN <Fill width="w-[26mm]" />
          </span>
          <span>
            สิทธิการรักษา: <strong>{RIGHT_LABELS[input.Patient_Right]}</strong>
          </span>
        </div>
        <div className="flex flex-wrap justify-between gap-x-[4mm] gap-y-[1mm] text-[8.5pt]">
          <span>
            ยาหลัก:{" "}
            <strong>
              {drug.Brand_Name} {fmt(drug.Strength_IU)} IU ({drug.Dosage_Form}) · Route: {input.Route}
            </strong>
          </span>
          <span>
            รอบวันฟอกเลือด:{" "}
            <strong>
              {freqCount(input.Dialysis_Freq)} ครั้ง/สัปดาห์ ({patternLabel(pattern, " - ")})
            </strong>
          </span>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-2 grid-rows-3 gap-[2.5mm]">
        {MONTHS.map((m) => (
          <MonthBlock key={m} month={m} input={input} drug={drug} dose={dose} pattern={pattern} plan={plan} />
        ))}
      </div>

      <footer className="space-y-[1mm] rounded-[1.5mm] border border-foreground/70 p-[2.5mm] text-[8pt]">
        <p>
          <strong>เป้าหมายการรักษา (Target Hb):</strong> 10.0 – 11.5 g/dL
          (ตามแนวทางการรักษาภาวะโลหิตจางในผู้ป่วยโรคไตเรื้อรัง ปี พ.ศ. 2564)
        </p>
        <p>
          <strong>ข้อควรระวังหลังปรับยา:</strong> ระดับ Hb ไม่ควรเพิ่มขึ้นเกิน 1.0 g/dL ภายในระยะเวลา 4 สัปดาห์ (1 เดือน)
        </p>
        <p className="pt-[1.5mm] text-right">
          ผู้ดูแล: ........................................
        </p>
      </footer>
    </div>
  );
}
