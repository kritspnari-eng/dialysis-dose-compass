import { describe, expect, it } from "vitest";
import { DRUGS, SAMPLE_CASES } from "./data";
import {
  DIALYSIS_PATTERNS,
  buildPlan,
  costSummary,
  findDosing,
  ironAssessment,
  missingLookupMessage,
  parseRegimen,
  placeDoses,
  recommendDose,
  roundToPackage,
  stepDose,
  unitCopay,
} from "./calc";
import { buildCopyNote } from "./note";

const drug = (id: string) => DRUGS.find((d) => d.Drug_ID === id)!;
const pattern = (freq: "2 ครั้ง/wk" | "3 ครั้ง/wk", id: string) =>
  DIALYSIS_PATTERNS[freq].find((p) => p.id === id)!;

describe("sample cases", () => {
  it.each(SAMPLE_CASES)("$label gives the expected weekly dose", (c) => {
    expect(recommendDose(c.input, drug(c.input.Selected_Drug_ID)).dose).toBe(c.expectedFinalWeeklyDose);
  });
});

describe("dose adjusts from current Hb only", () => {
  const base = SAMPLE_CASES[0]!.input; // EPIAO vial, previous 4,000 IU/wk
  const d = drug(base.Selected_Drug_ID);
  const at = (hb: number) => recommendDose({ ...base, Current_Hb: hb }, d);

  it("Hb < 10.0 → increase 25% (4,000 → 5,000 → next whole-vial step 6,000)", () => {
    expect(at(9.9)).toMatchObject({ action: "increase", rawDose: 5000, dose: 6000 });
  });
  it("Hb 10.0–11.5 → keep the same dose", () => {
    expect(at(10.0)).toMatchObject({ action: "maintain", dose: 4000 });
    expect(at(11.5)).toMatchObject({ action: "maintain", dose: 4000 });
  });
  it("Hb 11.6–12.9 → decrease 25%", () => {
    expect(at(11.6)).toMatchObject({ action: "decrease", rawDose: 3000, dose: 3000 });
    expect(at(12.9)).toMatchObject({ action: "decrease", rawDose: 3000, dose: 3000 });
  });
  it("Hb ≥ 13.0 → stop ESA (0 IU/wk, no injections, no vials)", () => {
    expect(at(13.0)).toMatchObject({ action: "hold", dose: 0 });
    const plan = buildPlan(0, d, "2 ครั้ง/wk", pattern("2 ครั้ง/wk", "mon-thu"))!;
    expect(plan.monthTotal).toMatchObject({ dose: 0, units: 0 });
    expect(Object.values(plan.variants[0]!.schedule).every((iu) => iu === null)).toBe(true);
  });
  it("stepping up from a stopped dose goes to the smallest deliverable dose", () => {
    expect(stepDose(0, d, 1)).toBe(2000);
    expect(stepDose(0, drug("EPO-06"), 1)).toBe(5000);
  });
});

describe("PFS doses are multiples of Strength_IU", () => {
  it("4,000 IU PFS rounds to 4,000 / 8,000 / 12,000", () => {
    const d = drug("EPO-05");
    expect(roundToPackage(5000, d, "up")).toBe(8000);
    expect(roundToPackage(6000, d, "down")).toBe(4000);
    expect(roundToPackage(11000, d, "nearest")).toBe(12000);
  });
  it("5,000 IU PFS rounds to 5,000 / 10,000 / 15,000", () => {
    const d = drug("EPO-06");
    expect(roundToPackage(6250, d, "up")).toBe(10000);
    expect(roundToPackage(7500, d, "down")).toBe(5000);
    expect(stepDose(10000, d, 1)).toBe(15000);
  });
  it("increasing a 5,000 IU PFS follow-up lands on a multiple of 5,000", () => {
    const c = { ...SAMPLE_CASES[0]!.input, Selected_Drug_ID: "EPO-06", Prev_Weekly_Dose_IU: 10000 };
    expect(recommendDose(c, drug("EPO-06")).dose % 5000).toBe(0);
  });
});

describe("missing Lookup_Key", () => {
  it("10,000 and 12,000 IU Vial at 2x/week have no regimen", () => {
    expect(findDosing(10000, "Vial", "2 ครั้ง/wk")).toBeUndefined();
    expect(buildPlan(12000, drug("EPO-01"), "2 ครั้ง/wk", pattern("2 ครั้ง/wk", "mon-thu"))).toBeNull();
  });
  it("shows the required warning text", () => {
    expect(missingLookupMessage("2 ครั้ง/wk")).toBe(
      "ไม่พบรูปแบบการแบ่งฉีดสำหรับความถี่ 2 ครั้ง/สัปดาห์ กรุณาปรับขนาดยาหรือเปลี่ยนรูปแบบยา",
    );
  });
});

describe("iron status assessment", () => {
  it("TSAT < 20 or Ferritin < 200 → deficient (give IV iron)", () => {
    expect(ironAssessment({ TSAT_Percent: 15, Ferritin_ng_mL: 300 }).status).toBe("deficient");
    expect(ironAssessment({ TSAT_Percent: 25, Ferritin_ng_mL: 150 }).status).toBe("deficient");
    expect(ironAssessment({ TSAT_Percent: 15, Ferritin_ng_mL: 150 }).note).toContain("ควรพิจารณาให้ IV Iron");
  });
  it("Ferritin > 500 or TSAT > 30 → high (hold IV iron)", () => {
    expect(ironAssessment({ TSAT_Percent: 25, Ferritin_ng_mL: 600 }).status).toBe("high");
    expect(ironAssessment({ TSAT_Percent: 35, Ferritin_ng_mL: 300 }).status).toBe("high");
    expect(ironAssessment({ TSAT_Percent: 35, Ferritin_ng_mL: 600 }).note).toContain("งด IV Iron");
  });
  it("TSAT 20–30 and Ferritin 200–500 → adequate (maintenance)", () => {
    expect(ironAssessment({ TSAT_Percent: 25, Ferritin_ng_mL: 350 }).status).toBe("adequate");
    expect(ironAssessment({ TSAT_Percent: 20, Ferritin_ng_mL: 200 }).status).toBe("adequate");
    expect(ironAssessment({ TSAT_Percent: 30, Ferritin_ng_mL: 500 }).status).toBe("adequate");
    expect(ironAssessment({ TSAT_Percent: 25, Ferritin_ng_mL: 350 }).note).toContain("Maintenance");
  });
});

describe("iron labs are optional", () => {
  const base = SAMPLE_CASES[0]!.input;
  it("blank TSAT and Ferritin → 'ไม่มีผลตรวจธาตุเหล็กในรอบนี้'", () => {
    const a = ironAssessment({ TSAT_Percent: null, Ferritin_ng_mL: null });
    expect(a.status).toBe("unknown");
    expect(a.title).toBe("ไม่มีผลตรวจธาตุเหล็กในรอบนี้");
    expect(a.note).toContain("ไม่มีผลตรวจธาตุเหล็กในรอบนี้");
  });
  it("only one value missing is still unknown", () => {
    expect(ironAssessment({ TSAT_Percent: 25, Ferritin_ng_mL: null }).status).toBe("unknown");
    expect(ironAssessment({ TSAT_Percent: null, Ferritin_ng_mL: 150 }).status).toBe("unknown");
  });
  it("ESA dose is unchanged when the iron labs are blank", () => {
    const d = drug(base.Selected_Drug_ID);
    expect(recommendDose({ ...base, TSAT_Percent: null, Ferritin_ng_mL: null }, d).dose).toBe(
      recommendDose(base, d).dose,
    );
  });
  it("copy note keeps Route: IV and flags the missing iron result", () => {
    const input = { ...base, TSAT_Percent: null, Ferritin_ng_mL: null };
    const d = drug(input.Selected_Drug_ID);
    const rec = recommendDose(input, d);
    const p = pattern("2 ครั้ง/wk", "mon-thu");
    const plan = buildPlan(rec.dose, d, input.Dialysis_Freq, p)!;
    const note = buildCopyNote({
      input,
      drug: d,
      rec,
      dose: rec.dose,
      overridden: false,
      pattern: p,
      plan,
      cost: costSummary(d, input.Patient_Right, plan.avgWeeklyUnits),
    });
    expect(note).toContain("Route: IV");
    expect(note).toContain("TSAT ไม่มีข้อมูล · Ferritin ไม่มีข้อมูล");
    expect(note).toContain("สถานะธาตุเหล็ก: ไม่มีผลตรวจธาตุเหล็กในรอบนี้");
  });
  it("copy note shows the iron advice when the labs are filled in", () => {
    const d = drug(base.Selected_Drug_ID);
    const rec = recommendDose(base, d);
    const p = pattern("2 ครั้ง/wk", "mon-thu");
    const plan = buildPlan(rec.dose, d, base.Dialysis_Freq, p)!;
    const note = buildCopyNote({
      input: base,
      drug: d,
      rec,
      dose: rec.dose,
      overridden: false,
      pattern: p,
      plan,
      cost: costSummary(d, base.Patient_Right, plan.avgWeeklyUnits),
    });
    expect(note).toContain("TSAT 18% · Ferritin 150 ng/mL");
    expect(note).toContain("ควรพิจารณาให้ IV Iron");
  });
});

describe("copay never negative", () => {
  it("is 0 when the cap is above the hospital price (EPOTIV, OFC)", () => {
    expect(unitCopay(drug("EPO-05"), "OFC")).toBe(0);
    expect(costSummary(drug("EPO-05"), "OFC", 1).month.copay).toBe(0);
  });
  it("is Hosp_Price - cap otherwise (EPIAO, UC: 266 - 180)", () => {
    expect(unitCopay(drug("EPO-01"), "UC")).toBe(86);
  });
  it("is the full price when the right is not eligible", () => {
    expect(unitCopay(drug("EPO-05"), "UC")).toBe(430);
  });
});

describe("doses follow the selected dialysis days", () => {
  it("4,000 + 2,000 IU on Tue-Fri puts 4,000 on Tue and 2,000 on Fri", () => {
    const r = parseRegimen("ฉีด 4,000 IU (จันทร์) + 2,000 IU (พฤหัสบดี)");
    const s = placeDoses(r.doses, "2 ครั้ง/wk", pattern("2 ครั้ง/wk", "tue-fri"));
    expect(s.tue).toBe(4000);
    expect(s.fri).toBe(2000);
    expect(s.mon).toBeNull();
  });
  it("3x/week Tue-Thu-Sat with 2 vials injects Tue and Sat, 4,000 IU each", () => {
    const plan = buildPlan(8000, drug("EPO-02"), "3 ครั้ง/wk", pattern("3 ครั้ง/wk", "tue-thu-sat"))!;
    const s = plan.variants[0]!.schedule;
    expect([s.tue, s.thu, s.sat]).toEqual([4000, null, 4000]);
  });
});

describe("Vial 4,000 IU: whole vials only, alternating odd/even weeks", () => {
  const vialUnits = (dose: number, freq: "2 ครั้ง/wk" | "3 ครั้ง/wk" = "3 ครั้ง/wk") => {
    const p = freq === "2 ครั้ง/wk" ? pattern(freq, "mon-thu") : pattern(freq, "mon-wed-fri");
    return buildPlan(dose, drug("EPO-01"), freq, p)!.months.map((m) => m.units);
  };

  it("2,000 IU: weeks 1 & 3 one vial, weeks 2 & 4 none", () => {
    expect(vialUnits(2000)).toEqual([1, 0, 1, 0]);
  });
  it("3,000 IU: weeks 1–3 one vial, week 4 none", () => {
    expect(vialUnits(3000)).toEqual([1, 1, 1, 0]);
  });
  it("6,000 IU: weeks 1 & 3 two vials, weeks 2 & 4 one vial, 6 vials/month", () => {
    const plan = buildPlan(6000, drug("EPO-01"), "2 ครั้ง/wk", pattern("2 ครั้ง/wk", "mon-thu"))!;
    expect(plan.months.map((m) => m.units)).toEqual([2, 1, 2, 1]);
    expect(plan.monthTotal).toMatchObject({ dose: 24000, units: 6 });
    const [odd, even] = plan.variants;
    expect(odd!.label).toBe("สัปดาห์ที่ 1 และ 3 (สัปดาห์คี่)");
    expect([odd!.schedule.mon, odd!.schedule.thu]).toEqual([4000, 4000]);
    expect(even!.label).toBe("สัปดาห์ที่ 2 และ 4 (สัปดาห์คู่)");
    expect([even!.schedule.mon, even!.schedule.thu]).toEqual([4000, null]);
  });
  it("10,000 IU: weeks 1 & 3 three vials, weeks 2 & 4 two vials", () => {
    expect(vialUnits(10000)).toEqual([3, 2, 3, 2]);
  });
  it("4,000 / 8,000 / 12,000 IU are the same every week", () => {
    expect(vialUnits(4000)).toEqual([1, 1, 1, 1]);
    expect(vialUnits(8000)).toEqual([2, 2, 2, 2]);
    expect(vialUnits(12000)).toEqual([3, 3, 3, 3]);
    expect(buildPlan(8000, drug("EPO-01"), "3 ครั้ง/wk", pattern("3 ครั้ง/wk", "mon-wed-fri"))!.alternating).toBe(false);
  });
  it("never injects a partial vial (no 1,000 or 2,000 IU injections)", () => {
    for (const dose of [2000, 3000, 4000, 6000, 8000, 10000, 12000]) {
      const plan = buildPlan(dose, drug("EPO-01"), "3 ครั้ง/wk", pattern("3 ครั้ง/wk", "mon-wed-fri"))!;
      for (const v of plan.variants)
        for (const iu of Object.values(v.schedule)) expect(iu === null || iu === 4000).toBe(true);
    }
  });
  it("copay per month uses the actual vials used (6,000 IU EPIAO UC = 6 × 86)", () => {
    const plan = buildPlan(6000, drug("EPO-01"), "2 ครั้ง/wk", pattern("2 ครั้ง/wk", "mon-thu"))!;
    expect(costSummary(drug("EPO-01"), "UC", plan.avgWeeklyUnits).month.copay).toBe(516);
  });
});
