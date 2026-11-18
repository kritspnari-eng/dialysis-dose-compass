import { AlertTriangle, Calculator, FlaskConical, Pill, RotateCcw, UserRound } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Segmented } from "@/components/esa/Segmented";
import { eligibility, fmt } from "@/lib/esa/calc";
import {
  DRUGS,
  RIGHT_LABELS,
  type DialysisFreq,
  type PatientInput,
  type PatientRight,
  type Route,
} from "@/lib/esa/data";

export type NumField =
  | "Dry_Weight_kg"
  | "Current_Hb"
  | "Previous_Hb"
  | "Current_Hct"
  | "Prev_Weekly_Dose_IU"
  | "TSAT_Percent"
  | "Ferritin_ng_mL";

export type FormState = Omit<PatientInput, NumField> & Record<NumField, string>;

export const toFormState = (p: PatientInput): FormState => ({
  ...p,
  Dry_Weight_kg: String(p.Dry_Weight_kg),
  Current_Hb: String(p.Current_Hb),
  Previous_Hb: p.Is_New_Case ? "" : String(p.Previous_Hb),
  Current_Hct: String(p.Current_Hct),
  Prev_Weekly_Dose_IU: String(p.Prev_Weekly_Dose_IU),
  TSAT_Percent: String(p.TSAT_Percent),
  Ferritin_ng_mL: String(p.Ferritin_ng_mL),
});

export const EMPTY_FORM: FormState = {
  Patient_Right: "UC",
  Is_New_Case: false,
  Selected_Drug_ID: "EPO-01",
  Route: "IV",
  Dialysis_Freq: "3 ครั้ง/wk",
  Dry_Weight_kg: "",
  Current_Hb: "",
  Previous_Hb: "",
  Current_Hct: "",
  Prev_Weekly_Dose_IU: "",
  TSAT_Percent: "",
  Ferritin_ng_mL: "",
};

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary">
        <span className="grid size-7 place-items-center rounded-md bg-sky text-sky-foreground">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function NumberInput({
  id,
  label,
  unit,
  value,
  onChange,
  disabled,
  step = "0.1",
}: {
  id: string;
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  step?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          step={step}
          min={0}
          value={disabled ? "" : value}
          placeholder={disabled ? "ไม่ใช้ในเคสใหม่" : ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 bg-card pr-16 font-num text-base"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
          {unit}
        </span>
      </div>
    </div>
  );
}

export function PatientForm({
  form,
  setForm,
  onCalculate,
  onReset,
  errors,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  onCalculate: () => void;
  onReset: () => void;
  errors: string[];
}) {
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm({ ...form, [k]: v });
  const drug = DRUGS.find((d) => d.Drug_ID === form.Selected_Drug_ID)!;
  const elig = eligibility(drug, form.Patient_Right);

  return (
    <form
      className="panel space-y-8 p-5 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        onCalculate();
      }}
    >
      <Section icon={<UserRound />} title="ข้อมูลทั่วไปและสิทธิการรักษา">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">สิทธิการรักษา</Label>
            <Select value={form.Patient_Right} onValueChange={(v) => set("Patient_Right", v as PatientRight)}>
              <SelectTrigger className="h-10 bg-card" aria-label="สิทธิการรักษา">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(RIGHT_LABELS) as PatientRight[]).map((r) => (
                  <SelectItem key={r} value={r}>
                    {RIGHT_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">ประเภทผู้ป่วย</Label>
            <Segmented
              ariaLabel="ประเภทผู้ป่วย"
              value={form.Is_New_Case ? "new" : "fu"}
              onChange={(v) => setForm({ ...form, Is_New_Case: v === "new" })}
              options={[
                { value: "new", label: "เคสใหม่" },
                { value: "fu", label: "ติดตามอาการ" },
              ]}
            />
          </div>
          <NumberInput
            id="weight"
            label="น้ำหนักแห้ง (Dry weight)"
            unit="kg"
            value={form.Dry_Weight_kg}
            onChange={(v) => set("Dry_Weight_kg", v)}
          />
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">ช่องทางบริหารยา</Label>
            <Segmented
              ariaLabel="ช่องทางบริหารยา"
              value={form.Route}
              onChange={(v) => set("Route", v as Route)}
              options={[
                { value: "IV", label: "IV" },
                { value: "SC", label: "SC" },
              ]}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">ความถี่การฟอกเลือด</Label>
            <Segmented
              ariaLabel="ความถี่การฟอกเลือด"
              value={form.Dialysis_Freq}
              onChange={(v) => set("Dialysis_Freq", v as DialysisFreq)}
              options={[
                { value: "2 ครั้ง/wk", label: "2 ครั้ง/สัปดาห์" },
                { value: "3 ครั้ง/wk", label: "3 ครั้ง/สัปดาห์" },
              ]}
            />
          </div>
        </div>
      </Section>

      <Section icon={<Pill />} title="การเลือกยา">
        <div className="space-y-2">
          <Select value={form.Selected_Drug_ID} onValueChange={(v) => set("Selected_Drug_ID", v)}>
            <SelectTrigger className="h-11 bg-card" aria-label="เลือกยา">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DRUGS.map((d) => {
                const e = eligibility(d, form.Patient_Right);
                return (
                  <SelectItem key={d.Drug_ID} value={d.Drug_ID}>
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{d.Brand_Name}</span>
                      <span className="text-muted-foreground">
                        {fmt(d.Strength_IU)} IU · {d.Dosage_Form}
                      </span>
                      <Badge variant={e.eligible ? "eligible" : "ineligible"} className="px-1.5 py-0 text-[10px]">
                        {e.eligible ? "เบิกได้" : "เบิกไม่ได้"}
                      </Badge>
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant={elig.eligible ? "eligible" : "ineligible"}>
              {elig.eligible ? `เบิกได้ตามสิทธิ ${form.Patient_Right}` : `เบิกไม่ได้ตามสิทธิ ${form.Patient_Right}`}
            </Badge>
            <span className="text-muted-foreground">
              ราคา รพ. {fmt(drug.Hosp_Price)} บาท/{drug.Dosage_Form === "PFS" ? "เข็ม" : "ขวด"}
              {elig.eligible && ` · เพดานเบิก ${fmt(elig.cap)} บาท`}
            </span>
          </div>
          {!elig.eligible && (
            <div className="flex items-start gap-2 rounded-lg border border-warning-border bg-warning-surface p-3 text-sm text-warning-foreground">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                {drug.Brand_Name} ไม่อยู่ในรายการเบิกของสิทธิ {RIGHT_LABELS[form.Patient_Right]} ผู้ป่วยต้องชำระเต็มราคา
              </span>
            </div>
          )}
        </div>
      </Section>

      <Section icon={<FlaskConical />} title="ผลแล็บและขนาดยาเดิม">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <NumberInput id="hb" label="Current Hb" unit="g/dL" value={form.Current_Hb} onChange={(v) => set("Current_Hb", v)} />
          <NumberInput
            id="prevhb"
            label="Previous Hb"
            unit="g/dL"
            value={form.Previous_Hb}
            onChange={(v) => set("Previous_Hb", v)}
            disabled={form.Is_New_Case}
          />
          <NumberInput id="hct" label="Current Hct" unit="%" value={form.Current_Hct} onChange={(v) => set("Current_Hct", v)} />
          <NumberInput
            id="prevdose"
            label="ขนาดยาเดิม/สัปดาห์"
            unit="IU"
            step="1000"
            value={form.Prev_Weekly_Dose_IU}
            onChange={(v) => set("Prev_Weekly_Dose_IU", v)}
            disabled={form.Is_New_Case}
          />
          <NumberInput id="tsat" label="TSAT" unit="%" value={form.TSAT_Percent} onChange={(v) => set("TSAT_Percent", v)} />
          <NumberInput
            id="ferritin"
            label="Ferritin"
            unit="ng/mL"
            step="1"
            value={form.Ferritin_ng_mL}
            onChange={(v) => set("Ferritin_ng_mL", v)}
          />
        </div>
      </Section>

      {errors.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-warning-border bg-warning-surface p-3 text-sm text-warning-foreground">
          {errors.map((e) => (
            <li key={e}>• {e}</li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <Button type="submit" variant="hero" size="xl" className="min-w-0 flex-1 px-3">
          <Calculator /> คำนวณแผนการให้ยา
        </Button>
        <Button type="button" variant="outline" size="xl" className="shrink-0 px-3 sm:px-5" onClick={onReset}>
          <RotateCcw /> ล้างข้อมูล<span className="hidden sm:inline"> (Reset)</span>
        </Button>
      </div>
    </form>
  );
}
