import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie } from "recharts";
import { COLORS, CATEGORY_COLORS, tooltipStyle } from "./dashboard-theme";
import { barIndex } from "./chart-index";
import type { AdminStats } from "./admin-stats";

// Click en una barra → onBar con el identificador del dato (vía estado del chart de recharts).
export function MonthlyApplications({ data, onBar }: { data: AdminStats["byMonth"]; onBar?: (ym: string) => void }) {
  return (
    <ResponsiveContainer width="100%" height={190}>
      <BarChart
        data={data}
        margin={{ top: 10, right: 6, left: -22, bottom: 0 }}
        onClick={(state) => {
          const i = barIndex(state?.activeIndex, data.length);
          if (i !== undefined) onBar?.(data[i].ym);
        }}
      >
        <XAxis dataKey="label" tick={{ fill: "#ffffff66", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip cursor={{ fill: "#ffffff0a" }} contentStyle={tooltipStyle} formatter={(value) => [value, "Postulaciones"]} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} fill={COLORS.postulaciones} cursor={onBar ? "pointer" : undefined} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CandidatesByArea({ data }: { data: AdminStats["byArea"] }) {
  return (
    <ResponsiveContainer width="100%" height={190}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="area" innerRadius={48} outerRadius={74} paddingAngle={2} stroke="none">
          {data.map((_, i) => (
            <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TopJobs({ data, onBar }: { data: AdminStats["topJobs"]; onBar?: (jobId: string) => void }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 36)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
        onClick={(state) => {
          const i = barIndex(state?.activeIndex, data.length);
          if (i !== undefined) onBar?.(data[i].jobId);
        }}
      >
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="title" width={120} tick={{ fill: "#ffffff99", fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: "#ffffff0a" }} contentStyle={tooltipStyle} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} fill={COLORS.puestos} cursor={onBar ? "pointer" : undefined} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SpontaneousVsLinked({ data }: { data: AdminStats["spontaneousVsLinked"] }) {
  const rows = [
    { name: "Por puesto", value: data.linked, fill: COLORS.candidatos },
    { name: "Espontáneas", value: data.spontaneous, fill: COLORS.espontaneas },
  ];
  return (
    <ResponsiveContainer width="100%" height={170}>
      <BarChart data={rows} margin={{ top: 10, right: 6, left: -22, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fill: "#ffffff66", fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip cursor={{ fill: "#ffffff0a" }} contentStyle={tooltipStyle} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {rows.map((r, i) => (
            <Cell key={i} fill={r.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
