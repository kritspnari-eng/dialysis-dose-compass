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
  it("3x/week Tue-Thu-Sat keeps 4,000 / 2,000 / 2,000 order", () => {
    const plan = buildPlan(8000, drug("EPO-02"), "3 ครั้ง/wk", pattern("3 ครั้ง/wk", "tue-thu-sat"))!;
    expect([plan.schedule.tue, plan.schedule.thu, plan.schedule.sat]).toEqual([4000, 2000, 2000]);
  });
  it("keeps the leftover vial note", () => {
    const plan = buildPlan(2000, drug("EPO-01"), "2 ครั้ง/wk", pattern("2 ครั้ง/wk", "wed-sat"))!;
    expect(plan.schedule.wed).toBe(2000);
    expect(plan.leftoverNote).toBe("เหลือยา 0.5 vial");
  });
  it("monthly total is weekly × 4", () => {
    const plan = buildPlan(6000, drug("EPO-01"), "2 ครั้ง/wk", pattern("2 ครั้ง/wk", "mon-thu"))!;
    expect(plan.monthTotal).toMatchObject({ dose: 24000, units: 6 });
  });
});
