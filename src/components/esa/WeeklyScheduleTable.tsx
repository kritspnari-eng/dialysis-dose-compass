import { Repeat } from "lucide-react";
import { Fragment } from "react";

import { Segmented } from "@/components/esa/Segmented";
import {
  DAY_LABEL,
  DAY_SHORT,
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

const CELL = "h-24 rounded-lg sm:h-28 sm:rounded-xl text-center align-middle";
const BIG_NUM =
  "font-num text-[0.8rem] font-bold leading-none min-[420px]:text-base sm:text-2xl lg:text-xl xl:text-2xl 2xl:text-[1.7rem]";

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
  const perInjection = (iu: number) => `${fmt(Math.round((iu / drug.Strength_IU) * 100) / 100)} ${unit}`;

  return (
    <div className="space-y-3">
      {plan.alternating && (
        <div className="flex items-start gap-2 rounded-lg border border-mint-border bg-mint px-3 py-2.5 text-sm text-mint-foreground">
          <Repeat className="mt-0.5 size-4 shrink-0" />
          <p>
            <strong>ฉีดสลับสัปดาห์</strong> ใช้ยาเต็มขวดครั้งละ {fmt(drug.Strength_IU)} IU ไม่แบ่งครึ่งขวด ·
            เฉลี่ย <span className="font-num font-semibold">{fmt(dose)}</span> IU/สัปดาห์
          </p>
        </div>
      )}

      <div className="-mx-1 px-1 pb-1">
        <table className="w-full table-fixed border-separate border-spacing-0.5 sm:border-spacing-1.5">
          <thead>
            <tr>
              {WEEK_DAYS.map((d) => {
                const dialysis = pattern.days.includes(d);
                return (
                  <th
                    key={d}
                    scope="col"
                    className={cn(
                      "rounded-md px-0.5 py-2 text-center text-xs font-semibold sm:text-sm",
                      dialysis ? "text-primary" : "text-rest-foreground",
                    )}
                  >
                    <span className="sm:hidden">{DAY_SHORT[d]}</span>
                    <span className="hidden sm:inline">{DAY_LABEL[d]}</span>
                    <span
                      className={cn(
                        "mt-0.5 block text-[10px] font-medium",
                        dialysis ? "text-sky-foreground" : "invisible",
                      )}
                    >
                      ●<span className="hidden sm:inline"> วันฟอกเลือด</span>
                    </span>
                  </th>
                );
              })}
              <th
                scope="col"
                className="rounded-md bg-sky px-0.5 py-2 text-center text-xs font-semibold text-sky-foreground sm:text-sm"
              >
                <span className="sm:hidden">รวม</span>
                <span className="hidden sm:inline">รวม/สัปดาห์</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {plan.variants.map((v, vi) => (
              <Fragment key={v.label}>
                {plan.alternating && (
                  <tr>
                    <th
                      colSpan={WEEK_DAYS.length + 1}
                      scope="rowgroup"
                      className={cn("px-1 pb-0.5 text-left", vi > 0 && "pt-3")}
                    >
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold sm:text-sm",
                          vi === 0 ? "bg-primary text-primary-foreground" : "bg-sky text-sky-foreground",
                        )}
                      >
                        {v.label}
                      </span>
                    </th>
                  </tr>
                )}
                <tr>
                  {WEEK_DAYS.map((d) => {
                    const iu = v.schedule[d];
                    const dialysis = pattern.days.includes(d);
                    if (iu) {
                      return (
                        <td key={d} className={cn(CELL, "border border-mint-border bg-mint text-mint-foreground")}>
                          <div className={BIG_NUM}>{fmt(iu)}</div>
                          <div className="mt-1 text-[10px] font-semibold sm:text-xs">IU</div>
                          <div className="mt-1.5 text-[10px] leading-tight opacity-80 sm:text-[11px]">
                            {perInjection(iu)}
                          </div>
                        </td>
                      );
                    }
                    return (
                      <td key={d} className={cn(CELL, "border border-dashed bg-rest text-rest-foreground")}>
                        <div className="text-[11px] font-medium sm:text-base">{dialysis ? "งดฉีด" : "-"}</div>
                        {dialysis && <div className="mt-1 hidden text-[11px] sm:block">ฟอกเลือดอย่างเดียว</div>}
                      </td>
                    );
                  })}
                  <td className={cn(CELL, "bg-primary text-primary-foreground shadow-card")}>
                    <div className={BIG_NUM}>{fmt(v.dose)}</div>
                    <div className="mt-1 text-[10px] font-semibold sm:text-xs">IU</div>
                    <div className="mt-1.5 text-[10px] leading-tight opacity-85 sm:text-[11px]">
                      {fmt(v.units)} {unit}
                    </div>
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
