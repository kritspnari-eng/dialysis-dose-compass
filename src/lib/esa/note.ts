import { RIGHT_LABELS, type Drug, type PatientInput } from "./data";
import {
  ACTION_LABEL,
  DAY_LABEL,
  fmt,
  fmtIU,
  ironAssessment,
  missingLookupMessage,
  patternLabel,
  unitName,
  type CostSummary,
  type DialysisPattern,
  type Plan,
  type Recommendation,
} from "./calc";

interface NoteArgs {
  input: PatientInput;
  drug: Drug;
  rec: Recommendation;
  dose: number;
  overridden: boolean;
  pattern: DialysisPattern;
  plan: Plan | null;
  cost: CostSummary | null;
}

/** Plain-text order summary formatted for pasting into HIS/EMR. */
export function buildCopyNote(a: NoteArgs): string {
  const { input: p, drug, rec, dose, plan, cost, pattern } = a;
  const unit = unitName(drug.Dosage_Form);
  const L: string[] = [];

  L.push(`[ESA Order] ${drug.Brand_Name} ${fmtIU(drug.Strength_IU)} (${drug.Dosage_Form}) · Route: ${p.Route}`);
  L.push(
    `สิทธิ: ${RIGHT_LABELS[p.Patient_Right]} · ${p.Is_New_Case ? "เคสใหม่" : "เคสติดตามอาการ"}${p.Dry_Weight_kg > 0 ? ` · น้ำหนักแห้ง ${fmt(p.Dry_Weight_kg)} kg` : ""}`,
  );
  const tsatText = p.TSAT_Percent === null ? "ไม่มีข้อมูล" : `${p.TSAT_Percent}%`;
  const ferritinText = p.Ferritin_ng_mL === null ? "ไม่มีข้อมูล" : `${p.Ferritin_ng_mL} ng/mL`;
  L.push(
    `Lab: Hb ${p.Current_Hb} g/dL${!p.Is_New_Case && p.Previous_Hb > 0 ? ` (เดิม ${p.Previous_Hb})` : ""} · Hct ${p.Current_Hct}% · TSAT ${tsatText} · Ferritin ${ferritinText}`,
  );
  const perKg = p.Dry_Weight_kg > 0 ? ` (≈${Math.round(dose / p.Dry_Weight_kg)} IU/kg/wk)` : "";
  const prev = !p.Is_New_Case && p.Prev_Weekly_Dose_IU > 0 ? ` · เดิม ${fmtIU(p.Prev_Weekly_Dose_IU)}` : "";
  L.push(
    `ขนาดยา: ${fmtIU(dose)}/สัปดาห์${perKg}${prev} · ${a.overridden ? "ปรับเองโดยผู้สั่งยา" : ACTION_LABEL[rec.action]}`,
  );
  L.push("");

  if (!plan) {
    L.push(`⚠ ${missingLookupMessage(p.Dialysis_Freq)}`);
  } else {
    L.push(`ตารางฉีดยา (ฟอกเลือด ${p.Dialysis_Freq.replace("/wk", "/สัปดาห์")} · ${patternLabel(pattern, " / ")})`);
    if (plan.alternating) {
      L.push(
        `  รูปแบบ: ฉีดสลับสัปดาห์ (สัปดาห์คี่ / สัปดาห์คู่) · ใช้ยาเต็ม${unit}ครั้งละ ${fmtIU(drug.Strength_IU)} ไม่แบ่งครึ่ง${unit}`,
      );
    }
    for (const v of plan.variants) {
      L.push(`  ${v.label}: รวม ${fmtIU(v.dose)} · ${fmt(v.units)} ${unit}`);
      for (const d of pattern.days) {
        const iu = v.schedule[d];
        L.push(`    - ${DAY_LABEL[d]}: ${iu ? fmtIU(iu) : "งดฉีด"}`);
      }
    }
    if (plan.alternating) L.push(`  เฉลี่ย: ${fmtIU(dose)}/สัปดาห์`);
    L.push("");
    L.push("สรุปรายเดือน (4 สัปดาห์)");
    for (const m of plan.months) {
      L.push(`  - สัปดาห์ที่ ${m.week}: ${m.units ? `${fmtIU(m.dose)} · ${fmt(m.units)} ${unit}` : `งดฉีด · 0 ${unit}`}`);
    }
    L.push(`  - รวมทั้งเดือน: ${fmtIU(plan.monthTotal.dose)} · ${fmt(plan.monthTotal.units)} ${unit}`);
    L.push(`  - การเบิก: ${plan.monthTotal.note}`);
  }

  if (cost) {
    L.push("");
    L.push(
      `ค่ายา/เดือน: ราคา รพ. ${fmt(cost.month.total)} บาท · เบิกได้ ${fmt(cost.month.reimbursed)} บาท · ผู้ป่วยชำระเพิ่ม ${fmt(cost.month.copay)} บาท (${plan?.alternating ? "เฉลี่ย " : ""}${fmt(cost.week.copay)} บาท/สัปดาห์)`,
    );
    if (!cost.eligible) L.push(`⚠ ยานี้เบิกตามสิทธิ ${p.Patient_Right} ไม่ได้`);
  }
  const iron = ironAssessment(p);
  L.push("");
  L.push(
    iron.status === "unknown"
      ? `สถานะธาตุเหล็ก: ${iron.title} → ยัังไม่สามารถแนะนำการให้ IV Iron`
      : `สถานะธาตุเหล็ก: TSAT ${tsatText} · Ferritin ${ferritinText} → ${iron.note}`,
  );
  return L.join("\n");
}
