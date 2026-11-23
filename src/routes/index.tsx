import { createFileRoute } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { useMemo, useState } from "react";

import { EMPTY_FORM, PatientForm, type FormState } from "@/components/esa/PatientForm";
import { PrintSheet } from "@/components/esa/PrintSheet";
import { EmptyResults, ResultsPanel } from "@/components/esa/ResultsPanel";
import {
  DIALYSIS_PATTERNS,
  buildPlan,
  costSummary,
  recommendDose,
  roundToPackage,
  stepDose,
} from "@/lib/esa/calc";
import { DRUGS, type PatientInput } from "@/lib/esa/data";
import { buildCopyNote } from "@/lib/esa/note";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ESA Dose Planner · คำนวณขนาดยา EPO และตารางฉีดยาฟอกเลือด" },
      {
        name: "description",
        content:
          "คำนวณขนาดยา Erythropoietin ตาม Hb จัดตารางฉีดยารายสัปดาห์/รายเดือนตามรอบวันฟอกเลือด และคำนวณส่วนต่างค่ายาตามสิทธิ UC, SSS, OFC",
      },
      { property: "og:title", content: "ESA Dose Planner · คำนวณขนาดยา EPO สำหรับผู้ป่วยฟอกเลือด" },
      {
        property: "og:description",
        content: "เครื่องมือสำหรับแพทย์และเภสัชกร: ปรับขนาดยา ESA จัดตารางฉีดยา และคัดลอกคำสั่งยาลงเวชระเบียน",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function parseForm(f: FormState): { input?: PatientInput; errors: string[] } {
  const n = (v: string) => (v.trim() === "" ? NaN : Number(v));
  const opt = (v: string) => (v.trim() === "" ? null : Number(v));
  const errors: string[] = [];
  const hb = n(f.Current_Hb);
  const prevDose = n(f.Prev_Weekly_Dose_IU);
  const tsat = opt(f.TSAT_Percent);
  const ferritin = opt(f.Ferritin_ng_mL);
  if (!(hb > 0)) errors.push("กรุณากรอก Hb ปัจจุบัน");
  if (!(prevDose > 0)) errors.push("กรุณากรอกขนาดยาเดิมต่อสัปดาห์");
  if (tsat !== null && !(tsat >= 0)) errors.push("TSAT ต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป");
  if (ferritin !== null && !(ferritin >= 0)) errors.push("Ferritin ต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป");
  if (errors.length) return { errors };
  return {
    errors,
    input: {
      Patient_Right: f.Patient_Right,
      Selected_Drug_ID: f.Selected_Drug_ID,
      Route: "IV",
      Dialysis_Freq: f.Dialysis_Freq,
      Current_Hb: hb,
      Current_Hct: n(f.Current_Hct) || 0,
      Prev_Weekly_Dose_IU: prevDose,
      TSAT_Percent: tsat,
      Ferritin_ng_mL: ferritin,
    },
  };
}

function Index() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<string[]>([]);
  const [input, setInput] = useState<PatientInput | null>(null);
  const [override, setOverride] = useState<number | null>(null);
  const [patternId, setPatternId] = useState<string>("");

  const calculate = (f: FormState) => {
    const res = parseForm(f);
    setErrors(res.errors);
    if (!res.input) return;
    setInput(res.input);
    setOverride(null);
    setPatternId(DIALYSIS_PATTERNS[res.input.Dialysis_Freq][0]!.id);
  };

  const result = useMemo(() => {
    if (!input) return null;
    const drug = DRUGS.find((d) => d.Drug_ID === input.Selected_Drug_ID)!;
    const rec = recommendDose(input, drug);
    const dose = override === null ? rec.dose : override > 0 ? roundToPackage(override, drug) : 0;
    const patterns = DIALYSIS_PATTERNS[input.Dialysis_Freq];
    const pattern = patterns.find((p) => p.id === patternId) ?? patterns[0]!;
    const plan = buildPlan(dose, drug, input.Dialysis_Freq, pattern);
    const cost = plan ? costSummary(drug, input.Patient_Right, plan.avgWeeklyUnits) : null;
    const overridden = override !== null && dose !== rec.dose;
    const note = buildCopyNote({ input, drug, rec, dose, overridden, pattern, plan, cost });
    return { drug, rec, dose, pattern, plan, cost, overridden, note };
  }, [input, override, patternId]);

  return (
    <>
    <div className="min-h-screen print:hidden">
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-4 sm:px-6">
          <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-lift">
            <Activity className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight sm:text-xl">ESA Dose Planner</h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              คำนวณขนาดยา Erythropoietin และจัดตารางฉีดยาสำหรับผู้ป่วยฟอกเลือด
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1440px] grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
        <div className="min-w-0 lg:sticky lg:top-6">
          <PatientForm
            form={form}
            setForm={setForm}
            errors={errors}
            onCalculate={() => calculate(form)}
            onReset={() => {
              setForm(EMPTY_FORM);
              setErrors([]);
              setInput(null);
              setOverride(null);
              setPatternId("");
            }}
          />
        </div>

        <div className="min-w-0">
        {input && result ? (
          <ResultsPanel
            input={input}
            drug={result.drug}
            rec={result.rec}
            dose={result.dose}
            overridden={result.overridden}
            onStep={(dir) => setOverride(stepDose(result.dose, result.drug, dir))}
            onReset={() => setOverride(null)}
            pattern={result.pattern}
            onPattern={setPatternId}
            plan={result.plan}
            cost={result.cost}
            note={result.note}
          />
        ) : (
          <EmptyResults />
        )}
        </div>
      </main>

      <footer className="mx-auto max-w-[1440px] px-4 pb-8 text-xs text-muted-foreground sm:px-6">
        ผลการคำนวณเป็นเครื่องมือช่วยตัดสินใจ ผู้สั่งยาควรตรวจสอบความเหมาะสมทางคลินิกทุกครั้ง
      </footer>
    </div>
    {input && result && (
      <PrintSheet input={input} drug={result.drug} dose={result.dose} pattern={result.pattern} plan={result.plan} />
    )}
    </>
  );
}
