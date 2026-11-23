import {
  DOSING_LOOKUP,
  type DialysisFreq,
  type DosageForm,
  type DosingRow,
  type Drug,
  type PatientInput,
  type PatientRight,
} from "./data";

/* ---------------------------------------------------------------- Days */

export type Day = "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
export const WEEK_DAYS: Day[] = ["mon", "tue", "wed", "thu", "fri", "sat"];
export const DAY_LABEL: Record<Day, string> = {
  mon: "จันทร์",
  tue: "อังคาร",
  wed: "พุธ",
  thu: "พฤหัสบดี",
  fri: "ศุกร์",
  sat: "เสาร์",
};
export const DAY_SHORT: Record<Day, string> = {
  mon: "จ.",
  tue: "อ.",
  wed: "พ.",
  thu: "พฤ.",
  fri: "ศ.",
  sat: "ส.",
};
const DAY_BY_NAME: Record<string, Day> = Object.fromEntries(
  Object.entries(DAY_LABEL).map(([k, v]) => [v, k as Day]),
);

export interface DialysisPattern {
  id: string;
  days: Day[];
}

export const DIALYSIS_PATTERNS: Record<DialysisFreq, DialysisPattern[]> = {
  "2 ครั้ง/wk": [
    { id: "mon-thu", days: ["mon", "thu"] },
    { id: "tue-fri", days: ["tue", "fri"] },
    { id: "wed-sat", days: ["wed", "sat"] },
  ],
  "3 ครั้ง/wk": [
    { id: "mon-wed-fri", days: ["mon", "wed", "fri"] },
    { id: "tue-thu-sat", days: ["tue", "thu", "sat"] },
  ],
};

export const patternLabel = (p: DialysisPattern, sep = " - ") =>
  p.days.map((d) => DAY_LABEL[d]).join(sep);

export const freqCount = (freq: DialysisFreq) => (freq === "2 ครั้ง/wk" ? 2 : 3);

/* ------------------------------------------------------------ Formatting */

export const fmt = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 2 });
export const fmtIU = (n: number) => `${fmt(n)} IU`;
export const unitName = (form: DosageForm) => (form === "PFS" ? "เข็ม" : "ขวด");

/* ------------------------------------------------------- Regimen parsing */

export interface ParsedDose {
  iu: number;
  sourceDay?: Day | undefined;
}
export interface ParsedRegimen {
  doses: ParsedDose[];
  leftoverNote?: string | undefined;
  alternative?: string | undefined;
  remark?: string | undefined;
}

const toNum = (s: string) => Number(s.replace(/,/g, ""));
const parseDays = (s?: string): Day[] =>
  (s ?? "")
    .split("-")
    .map((x) => DAY_BY_NAME[x.trim().replace(/^วัน/, "")])
    .filter((d): d is Day => Boolean(d));

const PEN = String.raw`(?:\s*\(\d+\s*เข็ม\))?`;

/** Splits a Suggested_Regimen sentence into ordered per-injection doses. */
export function parseRegimen(text: string): ParsedRegimen {
  let rest = text;
  const out: ParsedRegimen = { doses: [] };

  const leftover = rest.match(/\*([^*]+)\*/);
  if (leftover) {
    out.leftoverNote = (leftover[1] ?? "").trim();
    rest = rest.replace(leftover[0], "");
  }
  const [main = "", alt] = rest.split("หรือ");
  if (alt) out.alternative = alt.trim();
  rest = main;
  const remark = rest.match(/\((หมด[^)]*)\)/);
  if (remark) {
    out.remark = (remark[1] ?? "").trim();
    rest = rest.replace(remark[0], "");
  }
  rest = rest.replace(/^\s*ฉีด\s*/, "").trim();

  const multi = rest.match(
    new RegExp(String.raw`([\d,]+)\s*IU${PEN}\s*x\s*(\d+)\s*ครั้ง(?:\s*\(([^)]*)\))?`),
  );
  if (multi) {
    const iu = toNum(multi[1] ?? "0");
    const days = parseDays(multi[3]);
    for (let i = 0; i < Number(multi[2]); i++) out.doses.push({ iu, sourceDay: days[i] });
    return out;
  }
  const once = rest.match(
    new RegExp(String.raw`([\d,]+)\s*IU${PEN}\s*สัปดาห์ละ\s*1\s*ครั้ง(?:\s*\(([^)]*)\))?`),
  );
  if (once) {
    out.doses.push({ iu: toNum(once[1] ?? "0"), sourceDay: parseDays(once[2])[0] });
    return out;
  }
  for (const part of rest.split("+")) {
    const m = part.match(/([\d,]+)\s*IU(?:\s*\(([^)]*)\))?/);
    if (m) out.doses.push({ iu: toNum(m[1] ?? "0"), sourceDay: parseDays(m[2])[0] });
  }
  return out;
}

/** The CSV regimens are written for Mon-Thu (2x) or Mon-Wed-Fri (3x). */
const SOURCE_PATTERN: Record<DialysisFreq, Day[]> = {
  "2 ครั้ง/wk": ["mon", "thu"],
  "3 ครั้ง/wk": ["mon", "wed", "fri"],
};

export type WeekSchedule = Record<Day, number | null>;

/**
 * Places each dose on the selected dialysis days, keeping the same slot it had in
 * the source pattern (1st/2nd/3rd dialysis day of the week).
 */
export function placeDoses(
  doses: ParsedDose[],
  freq: DialysisFreq,
  pattern: DialysisPattern,
): WeekSchedule {
  const schedule = Object.fromEntries(WEEK_DAYS.map((d) => [d, null])) as WeekSchedule;
  const used = new Set<number>();
  doses.forEach((dose, i) => {
    let slot = dose.sourceDay ? SOURCE_PATTERN[freq].indexOf(dose.sourceDay) : i;
    if (slot < 0 || used.has(slot)) {
      slot = pattern.days.findIndex((_, idx) => !used.has(idx));
    }
    if (slot < 0 || slot >= pattern.days.length) return;
    used.add(slot);
    const day = pattern.days[slot];
    if (!day) return;
    schedule[day] = (schedule[day] ?? 0) + dose.iu;
  });
  return schedule;
}

/* ------------------------------------------------------- Dose selection */

/**
 * Vials used in weeks 1–4 for each deliverable Vial weekly dose. Vials are never split:
 * every injection is one full vial, and odd/even weeks alternate to hit the weekly average.
 */
export const VIAL_WEEK_PLANS: Record<number, readonly [number, number, number, number]> = {
  2000: [1, 0, 1, 0],
  3000: [1, 1, 1, 0],
  4000: [1, 1, 1, 1],
  6000: [2, 1, 2, 1],
  8000: [2, 2, 2, 2],
  10000: [3, 2, 3, 2],
  12000: [3, 3, 3, 3],
};

const VIAL_DOSES = Object.keys(VIAL_WEEK_PLANS)
  .map(Number)
  .sort((a, b) => a - b);

type Rounding = "up" | "down" | "nearest";

/** Rounds a weekly dose to something the package can deliver. PFS: multiple of Strength_IU. */
export function roundToPackage(raw: number, drug: Drug, mode: Rounding = "nearest"): number {
  if (drug.Dosage_Form === "PFS") {
    const s = drug.Strength_IU;
    const q = raw / s;
    const n = mode === "up" ? Math.ceil(q - 1e-9) : mode === "down" ? Math.floor(q + 1e-9) : Math.round(q);
    return Math.max(s, n * s);
  }
  const list = VIAL_DOSES;
  const min = list[0] ?? 0;
  const max = list[list.length - 1] ?? 0;
  if (mode === "up") return list.find((d) => d >= raw) ?? max;
  if (mode === "down") return [...list].reverse().find((d) => d <= raw) ?? min;
  return list.reduce((best, d) => (Math.abs(d - raw) < Math.abs(best - raw) ? d : best), min);
}

/** Manual override step: next/previous deliverable dose. */
export function stepDose(current: number, drug: Drug, dir: 1 | -1): number {
  if (current <= 0) return dir === 1 ? roundToPackage(0, drug, "up") : 0;
  if (drug.Dosage_Form === "PFS") {
    const s = drug.Strength_IU;
    return Math.max(s, roundToPackage(current, drug) + dir * s);
  }
  const i = VIAL_DOSES.indexOf(roundToPackage(current, drug));
  return VIAL_DOSES[Math.min(VIAL_DOSES.length - 1, Math.max(0, i + dir))] ?? current;
}

export type DoseAction = "increase" | "decrease" | "maintain" | "hold";
export interface Recommendation {
  dose: number;
  rawDose: number;
  action: DoseAction;
  reason: string;
}

export const ACTION_LABEL: Record<DoseAction, string> = {
  increase: "เพิ่มขนาดยา 25%",
  decrease: "ลดขนาดยา 25%",
  maintain: "คงขนาดยาเดิม",
  hold: "หยุดยาชั่วคราว",
};

/**
 * Adjusts the previous weekly dose from the current Hb only:
 * Hb < 10.0 → +25% · 10.0–11.5 → keep · 11.6–12.9 → −25% · ≥ 13.0 → hold (0 IU).
 */
export function recommendDose(p: PatientInput, drug: Drug): Recommendation {
  const prev = p.Prev_Weekly_Dose_IU;
  const hb = p.Current_Hb;
  if (hb >= 13.0) {
    return { dose: 0, rawDose: 0, action: "hold", reason: `Hb ${hb} g/dL ≥ 13.0 → หยุดยา ESA ชั่วคราว` };
  }
  if (hb < 10.0) {
    const raw = prev * 1.25;
    return {
      dose: roundToPackage(raw, drug, "up"),
      rawDose: raw,
      action: "increase",
      reason: `Hb ${hb} g/dL ต่ำกว่า 10.0 → เพิ่มขนาดยา 25% จาก ${fmtIU(prev)}`,
    };
  }
  if (hb > 11.5) {
    const raw = prev * 0.75;
    return {
      dose: roundToPackage(raw, drug, "down"),
      rawDose: raw,
      action: "decrease",
      reason: `Hb ${hb} g/dL อยู่ในช่วง 11.6–12.9 → ลดขนาดยา 25% จาก ${fmtIU(prev)}`,
    };
  }
  return {
    dose: roundToPackage(prev, drug, "nearest"),
    rawDose: prev,
    action: "maintain",
    reason: `Hb ${hb} g/dL อยู่ในช่วงเป้าหมาย 10.0–11.5 → คงขนาดยาเดิม`,
  };
}

/* ------------------------------------------------------------ Lookup */

export const lookupKey = (dose: number, form: DosageForm, freq: DialysisFreq) =>
  `${dose}_${form}_${freq}`;

export const findDosing = (dose: number, form: DosageForm, freq: DialysisFreq) =>
  DOSING_LOOKUP.find((r) => r.Lookup_Key === lookupKey(dose, form, freq));

export const missingLookupMessage = (freq: DialysisFreq) =>
  `ไม่พบรูปแบบการแบ่งฉีดสำหรับความถี่ ${freqCount(freq)} ครั้ง/สัปดาห์ กรุณาปรับขนาดยาหรือเปลี่ยนรูปแบบยา`;

/* ---------------------------------------------------------- Iron status */

export type IronStatus = "unknown" | "deficient" | "high" | "adequate";

export interface IronAssessment {
  status: IronStatus;
  title: string;
  advice: string;
  /** One-line summary for the copy note. */
  note: string;
}

/**
 * HD iron-status criteria:
 * - unknown: TSAT or Ferritin not entered → no iron advice this round
 * - deficient: TSAT < 20% or Ferritin < 200 ng/mL → consider IV iron
 * - high: Ferritin > 500 ng/mL or TSAT > 30% → hold IV iron
 * - adequate: TSAT 20–30% and Ferritin 200–500 ng/mL → maintenance per unit protocol
 */
export function ironAssessment(
  p: Pick<PatientInput, "TSAT_Percent" | "Ferritin_ng_mL">,
): IronAssessment {
  if (p.TSAT_Percent === null || p.Ferritin_ng_mL === null) {
    const missing = [p.TSAT_Percent === null ? "TSAT" : "", p.Ferritin_ng_mL === null ? "Ferritin" : ""]
      .filter(Boolean)
      .join(" และ ");
    return {
      status: "unknown",
      title: "ไม่มีผลตรวจธาตุเหล็กในรอบนี้",
      advice: `ยัังไม่ได้กรอกข้อมูล ${missing} จึงไม่สามารถประเมินสถานะธาตุเหล็กได้ ระบบยัังคำนวณขนาดยา ESA ตามปกติ`,
      note: "ไม่มีผลตรวจธาตุเหล็กในรอบนี้ → ยัังไม่สามารถแนะนำการให้ IV Iron",
    };
  }
  if (p.TSAT_Percent < 20 || p.Ferritin_ng_mL < 200) {
    return {
      status: "deficient",
      title: "ควรพิจารณาให้ IV Iron เสริม (ภาวะพร่องธาตุเหล็ก)",
      advice:
        "TSAT < 20% หรือ Ferritin < 200 ng/mL — การให้ธาตุเหล็กทางหลอดเลือดดำเสริมจะช่วยเพิ่มประสิทธิภาพการตอบสนองต่อยา ESA",
      note: "พร่องธาตุเหล็ก (TSAT < 20% หรือ Ferritin < 200 ng/mL) → ควรพิจารณาให้ IV Iron เสริม",
    };
  }
  if (p.Ferritin_ng_mL > 500 || p.TSAT_Percent > 30) {
    return {
      status: "high",
      title: "แนะนำให้งดให้ IV Iron ชั่วคราว (ธาตุเหล็กสะสมเพียงพอ/สูง)",
      advice:
        "Ferritin > 500 ng/mL หรือ TSAT > 30% — ธาตุเหล็กในร่างกายเพียงพอแล้ว ควรงด IV Iron และติดตามค่าซ้ำตามแนวทางของหน่วย",
      note: "ธาตุเหล็กสะสมเพียงพอ/สูง (Ferritin > 500 ng/mL หรือ TSAT > 30%) → แนะนำงด IV Iron ชั่วคราว",
    };
  }
  return {
    status: "adequate",
    title: "ธาตุเหล็กอยู่ในเกณฑ์เหมาะสม",
    advice:
      "TSAT 20–30% และ Ferritin 200–500 ng/mL — พิจารณาให้ IV Iron แบบ Maintenance ตามแนวทางของหน่วย",
    note: "ธาตุเหล็กอยู่ในเกณฑ์เหมาะสม (TSAT 20–30%, Ferritin 200–500 ng/mL) → พิจารณา IV Iron แบบ Maintenance ตามแนวทางของหน่วย",
  };
}

export const isIronDeficient = (p: Pick<PatientInput, "TSAT_Percent" | "Ferritin_ng_mL">) =>
  ironAssessment(p).status === "deficient";

/* ------------------------------------------------------- Eligibility/cost */

export function eligibility(drug: Drug, right: PatientRight) {
  if (right === "UC") return { eligible: drug.UC_Eligible, cap: drug.UC_Reimburse_Price };
  if (right === "SSS") return { eligible: drug.SSS_Eligible, cap: drug.SSS_Reimburse_Price };
  return { eligible: drug.OFC_LGO_Eligible, cap: drug.OFC_Cap_Price };
}

/** Per-unit patient copay: max(0, Hosp_Price - reimbursement cap). Never negative. */
export function unitCopay(drug: Drug, right: PatientRight) {
  const { eligible, cap } = eligibility(drug, right);
  return Math.max(0, drug.Hosp_Price - (eligible ? cap : 0));
}

export interface CostSummary {
  eligible: boolean;
  cap: number;
  capAboveHospPrice: boolean;
  week: { total: number; reimbursed: number; copay: number };
  month: { total: number; reimbursed: number; copay: number };
}

export function costSummary(drug: Drug, right: PatientRight, vialsPerWeek: number): CostSummary {
  const { eligible, cap } = eligibility(drug, right);
  const copay = unitCopay(drug, right);
  const reimbursedUnit = drug.Hosp_Price - copay;
  const week = {
    total: vialsPerWeek * drug.Hosp_Price,
    reimbursed: vialsPerWeek * reimbursedUnit,
    copay: vialsPerWeek * copay,
  };
  return {
    eligible,
    cap,
    capAboveHospPrice: eligible && cap >= drug.Hosp_Price,
    week,
    month: { total: week.total * 4, reimbursed: week.reimbursed * 4, copay: week.copay * 4 },
  };
}

/* --------------------------------------------------------- Weekly plan */

export interface MonthRow {
  week: number;
  dose: number;
  units: number;
  note: string;
}

/** A group of weeks (e.g. weeks 1 & 3) that share the same injection schedule. */
export interface WeekVariant {
  weeks: number[];
  label: string;
  schedule: WeekSchedule;
  dose: number;
  units: number;
}

export interface Plan {
  variants: WeekVariant[];
  /** True when the weeks of the month do not all get the same injections. */
  alternating: boolean;
  regimenText: string;
  alternative?: string | undefined;
  avgWeeklyUnits: number;
  months: MonthRow[];
  monthTotal: { dose: number; units: number; note: string };
}

/** Which dialysis-day slots receive a full vial, by number of vials that week. */
const VIAL_SLOTS: Record<DialysisFreq, Record<number, number[]>> = {
  "2 ครั้ง/wk": { 0: [], 1: [0], 2: [0, 1] },
  "3 ครั้ง/wk": { 0: [], 1: [0], 2: [0, 2], 3: [0, 1, 2] },
};

const emptySchedule = () => Object.fromEntries(WEEK_DAYS.map((d) => [d, null])) as WeekSchedule;

export function weekGroupLabel(weeks: number[]): string {
  const k = weeks.join(",");
  if (k === "1,2,3,4") return "ทุกสัปดาห์ (สัปดาห์ที่ 1–4)";
  if (k === "1,3") return "สัปดาห์ที่ 1 และ 3 (สัปดาห์คี่)";
  if (k === "2,4") return "สัปดาห์ที่ 2 และ 4 (สัปดาห์คู่)";
  if (weeks.length === 1) return `สัปดาห์ที่ ${weeks[0]}`;
  return `สัปดาห์ที่ ${weeks.slice(0, -1).join(", ")} และ ${weeks[weeks.length - 1]}`;
}

export function buildPlan(
  dose: number,
  drug: Drug,
  freq: DialysisFreq,
  pattern: DialysisPattern,
): Plan | null {
  const unit = unitName(drug.Dosage_Form);
  let weekly: { schedule: WeekSchedule; dose: number; units: number }[];
  let alternative: string | undefined;
  let sourceRegimen: string | undefined;

  if (dose <= 0) {
    // ESA on hold: every week is a no-injection week.
    weekly = [1, 2, 3, 4].map(() => ({ schedule: emptySchedule(), dose: 0, units: 0 }));
    sourceRegimen = "หยุดยา ESA ชั่วคราว";
  } else if (drug.Dosage_Form === "Vial") {
    const vials = VIAL_WEEK_PLANS[dose];
    if (!vials || Math.max(...vials) > freqCount(freq)) return null;
    weekly = vials.map((n) => {
      const schedule = emptySchedule();
      for (const slot of VIAL_SLOTS[freq][n] ?? []) {
        const day = pattern.days[slot];
        if (day) schedule[day] = drug.Strength_IU;
      }
      return { schedule, dose: n * drug.Strength_IU, units: n };
    });
  } else {
    const row = findDosing(dose, drug.Dosage_Form, freq);
    if (!row) return null;
    const regimen = parseRegimen(row.Suggested_Regimen);
    const schedule = placeDoses(regimen.doses, freq, pattern);
    weekly = [1, 2, 3, 4].map(() => ({ schedule, dose, units: row.Vials_Per_Week }));
    alternative = regimen.alternative;
    sourceRegimen = row.Suggested_Regimen;
  }

  const variants: WeekVariant[] = [];
  weekly.forEach((w, i) => {
    const same = variants.find((v) => v.units === w.units && v.dose === w.dose);
    if (same) same.weeks.push(i + 1);
    else variants.push({ ...w, weeks: [i + 1], label: "" });
  });
  for (const v of variants) v.label = weekGroupLabel(v.weeks);

  const injectionDays = (s: WeekSchedule) =>
    pattern.days.filter((d) => s[d]).map((d) => DAY_LABEL[d]).join(" - ");
  const regimenText =
    sourceRegimen ??
    variants
      .map(
        (v) =>
          `${v.label}: ${
            v.units
              ? `ฉีด ${fmtIU(drug.Strength_IU)} x ${v.units} ครั้ง (${injectionDays(v.schedule)})`
              : "งดฉีด"
          }`,
      )
      .join(" · ");

  const months = weekly.map((w, i) => ({
    week: i + 1,
    dose: w.dose,
    units: w.units,
    note:
      w.units === 0
        ? `งดฉีด · ไม่ต้องเปิด${unit}`
        : drug.Dosage_Form === "PFS"
          ? `ใช้ ${fmt(w.units)} เข็ม (เข็มละ ${fmt(drug.Strength_IU)} IU)`
          : `เปิด ${w.units} ขวด · ฉีดครั้งละ ${fmt(drug.Strength_IU)} IU เต็มขวด`,
  }));
  const monthUnits = months.reduce((a, m) => a + m.units, 0);
  const monthDose = months.reduce((a, m) => a + m.dose, 0);

  return {
    variants,
    alternating: variants.length > 1,
    regimenText,
    alternative,
    avgWeeklyUnits: monthUnits / 4,
    months,
    monthTotal: {
      dose: monthDose,
      units: monthUnits,
      note: monthUnits > 0 ? `เบิก ${fmt(monthUnits)} ${unit}` : "ไม่ต้องเบิกยา",
    },
  };
}
