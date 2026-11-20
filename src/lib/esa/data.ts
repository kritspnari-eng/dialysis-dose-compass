// Reference data transcribed from the uploaded CSV files
// (Master_Drugs.csv, Dosing_Schedule_Lookup.csv, Patient_Evaluation-v2.csv).

export type DosageForm = "Vial" | "PFS";
export type DialysisFreq = "2 ครั้ง/wk" | "3 ครั้ง/wk";
export type PatientRight = "UC" | "SSS" | "OFC";
export type Route = "IV" | "SC";

export interface Drug {
  Drug_ID: string;
  Brand_Name: string;
  Strength_IU: number;
  Dosage_Form: DosageForm;
  UC_Eligible: boolean;
  UC_Reimburse_Price: number;
  SSS_Eligible: boolean;
  SSS_Reimburse_Price: number;
  OFC_LGO_Eligible: boolean;
  OFC_Cap_Price: number;
  Hosp_Price: number;
}

export interface DosingRow {
  Lookup_Key: string;
  Target_Weekly_IU: number;
  Dosage_Form: DosageForm;
  Dialysis_Freq: DialysisFreq;
  Suggested_Regimen: string;
  Vials_Per_Week: number;
}

export interface PatientInput {
  Patient_Right: PatientRight;
  Is_New_Case: boolean;
  Dry_Weight_kg: number;
  Selected_Drug_ID: string;
  Route: Route;
  Dialysis_Freq: DialysisFreq;
  Current_Hb: number;
  Previous_Hb: number;
  Current_Hct: number;
  Prev_Weekly_Dose_IU: number;
  TSAT_Percent: number | null;
  Ferritin_ng_mL: number | null;
}

export const DRUGS: Drug[] = [
  { Drug_ID: "EPO-01", Brand_Name: "EPIAO", Strength_IU: 4000, Dosage_Form: "Vial", UC_Eligible: true, UC_Reimburse_Price: 180, SSS_Eligible: true, SSS_Reimburse_Price: 232, OFC_LGO_Eligible: true, OFC_Cap_Price: 192, Hosp_Price: 266 },
  { Drug_ID: "EPO-02", Brand_Name: "EPOKINE", Strength_IU: 4000, Dosage_Form: "Vial", UC_Eligible: true, UC_Reimburse_Price: 180, SSS_Eligible: true, SSS_Reimburse_Price: 350, OFC_LGO_Eligible: true, OFC_Cap_Price: 216, Hosp_Price: 380 },
  { Drug_ID: "EPO-03", Brand_Name: "ESPOGEN", Strength_IU: 4000, Dosage_Form: "Vial", UC_Eligible: true, UC_Reimburse_Price: 180, SSS_Eligible: true, SSS_Reimburse_Price: 350, OFC_LGO_Eligible: true, OFC_Cap_Price: 216, Hosp_Price: 380 },
  { Drug_ID: "EPO-04", Brand_Name: "HEMA-PLUS", Strength_IU: 4000, Dosage_Form: "Vial", UC_Eligible: true, UC_Reimburse_Price: 180, SSS_Eligible: true, SSS_Reimburse_Price: 335, OFC_LGO_Eligible: true, OFC_Cap_Price: 352, Hosp_Price: 380 },
  { Drug_ID: "EPO-05", Brand_Name: "EPOTIV", Strength_IU: 4000, Dosage_Form: "PFS", UC_Eligible: false, UC_Reimburse_Price: 0, SSS_Eligible: false, SSS_Reimburse_Price: 0, OFC_LGO_Eligible: true, OFC_Cap_Price: 1016, Hosp_Price: 430 },
  { Drug_ID: "EPO-06", Brand_Name: "RECORMON", Strength_IU: 5000, Dosage_Form: "PFS", UC_Eligible: false, UC_Reimburse_Price: 0, SSS_Eligible: false, SSS_Reimburse_Price: 0, OFC_LGO_Eligible: true, OFC_Cap_Price: 1295, Hosp_Price: 1058 },
];

const row = (
  iu: number,
  form: DosageForm,
  freq: DialysisFreq,
  regimen: string,
  vials: number,
): DosingRow => ({
  Lookup_Key: `${iu}_${form}_${freq}`,
  Target_Weekly_IU: iu,
  Dosage_Form: form,
  Dialysis_Freq: freq,
  Suggested_Regimen: regimen,
  Vials_Per_Week: vials,
});

export const DOSING_LOOKUP: DosingRow[] = [
  row(2000, "Vial", "2 ครั้ง/wk", "ฉีด 2,000 IU สัปดาห์ละ 1 ครั้ง (วันจันทร์) *เหลือยา 0.5 vial*", 0.5),
  row(2000, "Vial", "3 ครั้ง/wk", "ฉีด 2,000 IU สัปดาห์ละ 1 ครั้ง (วันจันทร์) *เหลือยา 0.5 vial*", 0.5),
  row(3000, "Vial", "2 ครั้ง/wk", "ฉีด 2,000 IU (จันทร์) + 1,000 IU (พฤหัสบดี)", 0.75),
  row(3000, "Vial", "3 ครั้ง/wk", "ฉีด 1,000 IU x 3 ครั้ง (จันทร์ - พุธ - ศุกร์)", 0.75),
  row(4000, "Vial", "2 ครั้ง/wk", "ฉีด 2,000 IU x 2 ครั้ง (จันทร์ - พฤหัสบดี) (หมด 1 ขวดพอดี)", 1.0),
  row(4000, "Vial", "3 ครั้ง/wk", "ฉีด 2,000 IU (จันทร์) + 2,000 IU (ศุกร์) หรือ 4,000 IU x 1 ครั้ง", 1.0),
  row(6000, "Vial", "2 ครั้ง/wk", "ฉีด 4,000 IU (จันทร์) + 2,000 IU (พฤหัสบดี)", 1.5),
  row(6000, "Vial", "3 ครั้ง/wk", "ฉีด 2,000 IU x 3 ครั้ง (จันทร์ - พุธ - ศุกร์) (หมด 1.5 ขวด)", 1.5),
  row(8000, "Vial", "2 ครั้ง/wk", "ฉีด 4,000 IU x 2 ครั้ง (จันทร์ - พฤหัสบดี) (หมด 2 ขวดพอดี)", 2.0),
  row(8000, "Vial", "3 ครั้ง/wk", "ฉีด 4,000 IU (จันทร์) + 2,000 IU (พุธ) + 2,000 IU (ศุกร์)", 2.0),
  row(10000, "Vial", "3 ครั้ง/wk", "ฉีด 4,000 IU (จันทร์) + 4,000 IU (พุธ) + 2,000 IU (ศุกร์)", 2.5),
  row(12000, "Vial", "3 ครั้ง/wk", "ฉีด 4,000 IU x 3 ครั้ง (จันทร์ - พุธ - ศุกร์) (หมด 3 ขวดพอดี)", 3.0),
  row(4000, "PFS", "2 ครั้ง/wk", "ฉีด 4,000 IU (1 เข็ม) สัปดาห์ละ 1 ครั้ง (วันจันทร์)", 1.0),
  row(4000, "PFS", "3 ครั้ง/wk", "ฉีด 4,000 IU (1 เข็ม) สัปดาห์ละ 1 ครั้ง (วันจันทร์)", 1.0),
  row(8000, "PFS", "2 ครั้ง/wk", "ฉีด 4,000 IU (1 เข็ม) x 2 ครั้ง (จันทร์ - พฤหัสบดี)", 2.0),
  row(8000, "PFS", "3 ครั้ง/wk", "ฉีด 4,000 IU (1 เข็ม) x 2 ครั้ง (จันทร์ - ศุกร์)", 2.0),
  row(12000, "PFS", "3 ครั้ง/wk", "ฉีด 4,000 IU (1 เข็ม) x 3 ครั้ง (จันทร์ - พุธ - ศุกร์)", 3.0),
  row(5000, "PFS", "2 ครั้ง/wk", "ฉีด 5,000 IU (1 เข็ม) สัปดาห์ละ 1 ครั้ง (วันจันทร์)", 1.0),
  row(5000, "PFS", "3 ครั้ง/wk", "ฉีด 5,000 IU (1 เข็ม) สัปดาห์ละ 1 ครั้ง (วันจันทร์)", 1.0),
  row(10000, "PFS", "2 ครั้ง/wk", "ฉีด 5,000 IU (1 เข็ม) x 2 ครั้ง (จันทร์ - พฤหัสบดี)", 2.0),
  row(10000, "PFS", "3 ครั้ง/wk", "ฉีด 5,000 IU (1 เข็ม) x 2 ครั้ง (จันทร์ - ศุกร์)", 2.0),
  row(15000, "PFS", "3 ครั้ง/wk", "ฉีด 5,000 IU (1 เข็ม) x 3 ครั้ง (จันทร์ - พุธ - ศุกร์)", 3.0),
];

export interface SampleCase {
  label: string;
  input: PatientInput;
  expectedFinalWeeklyDose: number;
}

export const SAMPLE_CASES: SampleCase[] = [
  {
    label: "เคส 1 · UC ติดตามอาการ",
    expectedFinalWeeklyDose: 6000,
    input: { Patient_Right: "UC", Is_New_Case: false, Dry_Weight_kg: 55, Selected_Drug_ID: "EPO-01", Route: "IV", Dialysis_Freq: "2 ครั้ง/wk", Current_Hb: 9.5, Previous_Hb: 9.2, Current_Hct: 28.5, Prev_Weekly_Dose_IU: 4000, TSAT_Percent: 18, Ferritin_ng_mL: 150 },
  },
  {
    label: "เคส 2 · SSS ติดตามอาการ",
    expectedFinalWeeklyDose: 6000,
    input: { Patient_Right: "SSS", Is_New_Case: false, Dry_Weight_kg: 62.5, Selected_Drug_ID: "EPO-02", Route: "IV", Dialysis_Freq: "3 ครั้ง/wk", Current_Hb: 11.8, Previous_Hb: 10.5, Current_Hct: 36.5, Prev_Weekly_Dose_IU: 8000, TSAT_Percent: 28, Ferritin_ng_mL: 420 },
  },
  {
    label: "เคส 3 · OFC เคสใหม่",
    expectedFinalWeeklyDose: 4000,
    input: { Patient_Right: "OFC", Is_New_Case: true, Dry_Weight_kg: 50, Selected_Drug_ID: "EPO-05", Route: "IV", Dialysis_Freq: "2 ครั้ง/wk", Current_Hb: 8.8, Previous_Hb: 0, Current_Hct: 26.4, Prev_Weekly_Dose_IU: 0, TSAT_Percent: 25, Ferritin_ng_mL: 310 },
  },
];

export const RIGHT_LABELS: Record<PatientRight, string> = {
  UC: "UC (บัตรทอง)",
  SSS: "SSS (ประกันสังคม)",
  OFC: "OFC (ข้าราชการ/อปท.)",
};
