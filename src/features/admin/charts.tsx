import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LabelList } from "recharts";
import { COLORS, tooltipStyle } from "./dashboard-theme";
import { barIndex } from "./chart-index";
import type { AdminStats } from "./admin-stats";

// Click en una barra → onBar con el mes. El número va escrito arriba de cada
// barra: antes había que pasar el mouse por encima para saber cuánto era.
// (Los demás gráficos del Resumen pasaron a ser listas: ver RankedList.)
export function MonthlyApplications({ data, onBar }: { data: AdminStats["byMonth"]; onBar?: (ym: string) => void }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart
        data={data}
        margin={{ top: 18, right: 6, left: -22, bottom: 0 }}
        onClick={(state) => {
          const i = barIndex(state?.activeIndex, data.length);
          if (i !== undefined) onBar?.(data[i].ym);
        }}
      >
        <XAxis dataKey="label" tick={{ fill: "#ffffff66", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip cursor={{ fill: "#ffffff0a" }} contentStyle={tooltipStyle} formatter={(value) => [value, "Postulaciones"]} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} fill={COLORS.postulaciones} cursor={onBar ? "pointer" : undefined}>
          <LabelList dataKey="count" position="top" fill="#ffffffb3" fontSize={11} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
