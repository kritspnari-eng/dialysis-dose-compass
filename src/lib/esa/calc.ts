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

const VIAL_DOSES = [
  ...new Set(DOSING_LOOKUP.filter((r) => r.Dosage_Form === "Vial").map((r) => r.Target_Weekly_IU)),
].sort((a, b) => a - b);

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
  if (drug.Dosage_Form === "PFS") {
    const s = drug.Strength_IU;
    return Math.max(s, roundToPackage(current, drug) + dir * s);
  }
  const i = VIAL_DOSES.indexOf(roundToPackage(current, drug));
  return VIAL_DOSES[Math.min(VIAL_DOSES.length - 1, Math.max(0, i + dir))] ?? current;
}

export type DoseAction = "start" | "increase" | "decrease" | "maintain";
export interface Recommendation {
  dose: number;
  rawDose: number;
  action: DoseAction;
  reason: string;
}

export const ACTION_LABEL: Record<DoseAction, string> = {
  start: "เริ่มยา (เคสใหม่)",
  increase: "เพิ่มขนาดยา 25%",
  decrease: "ลดขนาดยา 25%",
  maintain: "คงขนาดยาเดิม",
};

export function recommendDose(p: PatientInput, drug: Drug): Recommendation {
  const startDose = (): Recommendation => {
    const raw = p.Dry_Weight_kg * 90;
    return {
      dose: roundToPackage(raw, drug, "nearest"),
      rawDose: raw,
      action: "start",
      reason: `เริ่มต้น 80–100 IU/kg/wk (${fmt(p.Dry_Weight_kg)} kg × 90 ≈ ${fmt(Math.round(raw))} IU)`,
    };
  };
  if (p.Is_New_Case) return startDose();
  if (!(p.Prev_Weekly_Dose_IU > 0)) {
    const r = startDose();
    return { ...r, reason: `ไม่มีขนาดยาเดิม จึงใช้สูตรเริ่มต้น: ${r.reason}` };
  }

  const prev = p.Prev_Weekly_Dose_IU;
  const rise = p.Previous_Hb > 0 ? p.Current_Hb - p.Previous_Hb : 0;
  const riseText = p.Previous_Hb > 0 ? ` (เปลี่ยนแปลง ${rise >= 0 ? "+" : ""}${rise.toFixed(1)} g/dL)` : "";

  if (p.Current_Hb > 11.5 || rise > 1.0) {
    const raw = prev * 0.75;
    return {
      dose: roundToPackage(raw, drug, "down"),
      rawDose: raw,
      action: "decrease",
      reason:
        p.Current_Hb > 11.5
          ? `Hb ${p.Current_Hb} g/dL สูงกว่า 11.5${riseText}`
          : `Hb เพิ่มขึ้นเร็วเกิน 1.0 g/dL${riseText}`,
    };
  }
  if (p.Current_Hb < 10.0 && rise < 1.0) {
    const raw = prev * 1.25;
    return {
      dose: roundToPackage(raw, drug, "up"),
      rawDose: raw,
      action: "increase",
      reason: `Hb ${p.Current_Hb} g/dL ต่ำกว่า 10.0 และเพิ่มขึ้นน้อยกว่า 1.0 g/dL${riseText}`,
    };
  }
  return {
    dose: roundToPackage(prev, drug, "nearest"),
    rawDose: prev,
    action: "maintain",
    reason: `Hb ${p.Current_Hb} g/dL อยู่ในช่วงเป้าหมาย 10.0–11.5${riseText}`,
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

export const isIronDeficient = (p: Pick<PatientInput, "TSAT_Percent" | "Ferritin_ng_mL">) =>
  p.TSAT_Percent < 20 || p.Ferritin_ng_mL < 200;

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

export interface Plan {
  row: DosingRow;
  regimen: ParsedRegimen;
  schedule: WeekSchedule;
  leftoverNote?: string | undefined;
  months: MonthRow[];
  monthTotal: { dose: number; units: number; note: string };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function buildPlan(
  dose: number,
  drug: Drug,
  freq: DialysisFreq,
  pattern: DialysisPattern,
): Plan | null {
  const row = findDosing(dose, drug.Dosage_Form, freq);
  if (!row) return null;
  const regimen = parseRegimen(row.Suggested_Regimen);
  const schedule = placeDoses(regimen.doses, freq, pattern);
  const units = row.Vials_Per_Week;
  const unit = unitName(drug.Dosage_Form);
  const opened = Math.ceil(units - 1e-9);
  const leftover = round2(opened - units);

  const leftoverNote =
    regimen.leftoverNote ??
    (drug.Dosage_Form === "Vial" && leftover > 0 ? `เหลือยา ${fmt(leftover)} vial` : undefined);

  const weekNote =
    drug.Dosage_Form === "PFS"
      ? `ใช้ ${fmt(units)} เข็ม (เข็มละ ${fmt(drug.Strength_IU)} IU)`
      : leftover > 0
        ? `เปิด ${opened} ขวด · เหลือยา ${fmt(leftover)} vial`
        : `เปิด ${opened} ขวด · ใช้หมดพอดี`;

  const months = [1, 2, 3, 4].map((week) => ({ week, dose, units, note: weekNote }));
  const monthUnits = round2(units * 4);
  const monthNote =
    drug.Dosage_Form === "Vial" && leftover > 0
      ? `เบิก ${fmt(monthUnits)} ${unit} (หากไม่ใช้เศษข้ามสัปดาห์ ต้องเปิด ${opened * 4} ${unit})`
      : `เบิก ${fmt(monthUnits)} ${unit}`;

  return {
    row,
    regimen,
    schedule,
    leftoverNote,
    months,
    monthTotal: { dose: dose * 4, units: monthUnits, note: monthNote },
  };
}
