import { describe, expect, it } from "vitest";
import { DRUGS, SAMPLE_CASES } from "./data";
import {
  DIALYSIS_PATTERNS,
  buildPlan,
  costSummary,
  findDosing,
  missingLookupMessage,
  parseRegimen,
  placeDoses,
  recommendDose,
  roundToPackage,
  stepDose,
  unitCopay,
} from "./calc";

const drug = (id: string) => DRUGS.find((d) => d.Drug_ID === id)!;
const pattern = (freq: "2 ครั้ง/wk" | "3 ครั้ง/wk", id: string) =>
  DIALYSIS_PATTERNS[freq].find((p) => p.id === id)!;

describe("sample cases", () => {
  it.each(SAMPLE_CASES)("$label gives the expected weekly dose", (c) => {
    expect(recommendDose(c.input, drug(c.input.Selected_Drug_ID)).dose).toBe(c.expectedFinalWeeklyDose);
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
