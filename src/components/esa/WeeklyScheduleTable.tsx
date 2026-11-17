import { CalendarDays, Info } from "lucide-react";

import { Segmented } from "@/components/esa/Segmented";
import {
  DAY_LABEL,
  DIALYSIS_PATTERNS,
  WEEK_DAYS,
  fmt,
  freqCount,
  patternLabel,
  unitName,
  type DialysisPattern,
  type Plan,
} from "@/lib/esa/calc";
import type { DialysisFreq, Drug } from "@/lib/esa/data";
import { cn } from "@/lib/utils";

export function PatternPicker({
  freq,
  pattern,
  onChange,
}: {
  freq: DialysisFreq;
  pattern: DialysisPattern;
  onChange: (id: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">
        รอบวันฟอกเลือดของคนไข้ ({freqCount(freq)} ครั้ง/สัปดาห์)
      </p>
      <Segmented
        ariaLabel="รอบวันฟอกเลือดของคนไข้"
        value={pattern.id}
        onChange={onChange}
        options={DIALYSIS_PATTERNS[freq].map((p) => ({ value: p.id, label: patternLabel(p) }))}
      />
    </div>
  );
}

export function WeeklyScheduleTable({
  plan,
  pattern,
  drug,
  dose,
}: {
  plan: Plan;
  pattern: DialysisPattern;
  drug: Drug;
  dose: number;
}) {
  const unit = unitName(drug.Dosage_Form);
  const perInjection = (iu: number) => {
    const n = Math.round((iu / drug.Strength_IU) * 100) / 100;
    return `${fmt(n)} ${unit}`;
  };

  return (
    <div className="space-y-3">
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <table className="w-full min-w-[640px] table-fixed border-separate border-spacing-1.5">
          <thead>
            <tr>
              {WEEK_DAYS.map((d) => {
                const dialysis = pattern.days.includes(d);
                return (
                  <th
                    key={d}
                    scope="col"
                    className={cn(
                      "rounded-md px-1 py-2 text-center text-sm font-semibold",
                      dialysis ? "text-primary" : "text-rest-foreground",
                    )}
                  >
                    {DAY_LABEL[d]}
                    <span
                      className={cn(
                        "mt-0.5 block text-[10px] font-medium",
                        dialysis ? "text-sky-foreground" : "invisible",
                      )}
                    >
                      ● วันฟอกเลือด
                    </span>
                  </th>
                );
              })}
              <th scope="col" className="rounded-md bg-sky px-1 py-2 text-center text-sm font-semibold text-sky-foreground">
                รวม/สัปดาห์
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              {WEEK_DAYS.map((d) => {
                const iu = plan.schedule[d];
                const dialysis = pattern.days.includes(d);
                if (iu) {
                  return (
                    <td
                      key={d}
                      className="h-28 rounded-xl border border-mint-border bg-mint text-center align-middle text-mint-foreground"
                    >
                      <div className="font-num text-2xl font-bold leading-none xl:text-[1.7rem]">{fmt(iu)}</div>
                      <div className="mt-1 text-xs font-semibold">IU</div>
                      <div className="mt-1.5 text-[11px] opacity-80">{perInjection(iu)}</div>
                    </td>
                  );
                }
                return (
                  <td
                    key={d}
                    className="h-28 rounded-xl border border-dashed bg-rest text-center align-middle text-rest-foreground"
                  >
                    <div className="text-lg font-medium">{dialysis ? "งด" : "-"}</div>
                    {dialysis && <div className="mt-1 text-[11px]">ฟอกเลือด ไม่ฉีดยา</div>}
                  </td>
                );
              })}
              <td className="h-28 rounded-xl bg-primary text-center align-middle text-primary-foreground shadow-card">
                <div className="font-num text-2xl font-bold leading-none xl:text-[1.7rem]">{fmt(dose)}</div>
                <div className="mt-1 text-xs font-semibold">IU</div>
                <div className="mt-1.5 text-[11px] opacity-85">
                  {fmt(plan.row.Vials_Per_Week)} {unit}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {plan.leftoverNote && (
        <div className="flex items-center gap-2 rounded-lg border border-caution-border bg-caution-surface px-3 py-2.5 text-sm font-semibold text-caution-foreground">
          <Info className="size-4 shrink-0" />*{plan.leftoverNote}*
        </div>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="size-3.5" /> สูตรอ้างอิง: {plan.row.Suggested_Regimen}
        </span>
        {plan.regimen.remark && <span>· {plan.regimen.remark}</span>}
        {plan.regimen.alternative && <span>· ทางเลือก: {plan.regimen.alternative}</span>}
      </div>
    </div>
  );
}
