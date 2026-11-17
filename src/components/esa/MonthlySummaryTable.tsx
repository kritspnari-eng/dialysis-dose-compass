import { fmt, unitName, type Plan } from "@/lib/esa/calc";
import type { Drug } from "@/lib/esa/data";

export function MonthlySummaryTable({ plan, drug }: { plan: Plan; drug: Drug }) {
  const unit = unitName(drug.Dosage_Form);
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-muted text-left text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">สัปดาห์ที่</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">ขนาดยารวม (IU)</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">จำนวน{unit}ที่ใช้</th>
            <th scope="col" className="px-4 py-3 font-semibold">หมายเหตุการเบิก/เปิด{unit}ยา</th>
          </tr>
        </thead>
        <tbody>
          {plan.months.map((m) => (
            <tr key={m.week} className="border-t">
              <td className="px-4 py-3 font-medium">สัปดาห์ที่ {m.week}</td>
              <td className="px-4 py-3 text-right font-num text-base font-semibold">{fmt(m.dose)}</td>
              <td className="px-4 py-3 text-right font-num text-base">
                {fmt(m.units)} <span className="text-xs text-muted-foreground">{unit}</span>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{m.note}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-mint-border bg-mint text-mint-foreground">
            <th scope="row" className="px-4 py-4 text-left font-bold">
              รวมทั้งหมดต่อเดือน
              <span className="block text-xs font-medium opacity-80">(4 สัปดาห์)</span>
            </th>
            <td className="px-4 py-4 text-right">
              <span className="font-num text-2xl font-bold">{fmt(plan.monthTotal.dose)}</span>
              <span className="ml-1 text-xs font-semibold">IU/เดือน</span>
            </td>
            <td className="px-4 py-4 text-right">
              <span className="font-num text-2xl font-bold">{fmt(plan.monthTotal.units)}</span>
              <span className="ml-1 text-xs font-semibold">{unit}</span>
            </td>
            <td className="px-4 py-4 text-sm font-semibold">{plan.monthTotal.note}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
