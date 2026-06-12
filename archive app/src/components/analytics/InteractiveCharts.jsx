/**
 * InteractiveCharts (§354) — recharts-based interactive analytics for the
 * Reports page: archive growth over time, content-type distribution, and the
 * most-used tags. Data is computed in `ReportsPage` / `features/analytics`;
 * this component is presentational.
 *
 * Recharts ships only inside the (already lazy-loaded) Reports page chunk, so
 * it does not affect the initial bundle.
 */
import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

// Palette tuned to the app's teal/emerald identity with distinct complements.
const PALETTE = ["#14b8a6", "#0ea5e9", "#a855f7", "#f59e0b", "#ef4444", "#22c55e", "#6366f1", "#ec4899"];
const AXIS_COLOR = "rgba(148, 163, 184, 0.65)";
const GRID_COLOR = "rgba(148, 163, 184, 0.15)";

const tooltipStyle = {
  background: "rgba(15, 23, 42, 0.95)",
  border: "1px solid rgba(148, 163, 184, 0.25)",
  borderRadius: "0.75rem",
  color: "#fff",
  fontSize: "0.8rem",
  direction: "rtl"
};

function ChartCard({ title, hint, isEmpty, children }) {
  return (
    <section className="va-chart-card rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-right" dir="rtl">
      <header className="mb-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
      </header>
      {isEmpty ? (
        <p className="flex h-[220px] items-center justify-center text-sm text-gray-500">لا توجد بيانات كافية للعرض بعد.</p>
      ) : (
        <div className="h-[220px] w-full" dir="ltr">{children}</div>
      )}
    </section>
  );
}

/**
 * @param {{
 *   growth?: Array<{ label: string, value: number }>,
 *   types?: Array<{ label: string, value: number }>,
 *   tags?: Array<{ label: string, value: number }>
 * }} props
 */
export function InteractiveCharts({ growth = [], types = [], tags = [] }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <ChartCard title="نمو الأرشيف بمرور الوقت" hint="عدد العناصر المُضافة شهريًا (آخر 12 شهرًا)" isEmpty={growth.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={growth} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="vaGrowthFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fill: AXIS_COLOR, fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRID_COLOR }} />
              <YAxis allowDecimals={false} tick={{ fill: AXIS_COLOR, fontSize: 11 }} tickLine={false} axisLine={false} width={32} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: GRID_COLOR }} />
              <Area type="monotone" dataKey="value" name="عناصر" stroke="#14b8a6" strokeWidth={2} fill="url(#vaGrowthFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="توزيع الأنواع" hint="حصة كل نوع محتوى من الأرشيف النشط" isEmpty={types.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={types} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2}>
              {types.map((entry, index) => (
                <Cell key={entry.label} fill={PALETTE[index % PALETTE.length]} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="أكثر الوسوم استخدامًا" hint="أعلى 10 وسوم تكرارًا" isEmpty={tags.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={tags} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
            <XAxis type="number" allowDecimals={false} tick={{ fill: AXIS_COLOR, fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="label" width={90} tick={{ fill: AXIS_COLOR, fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: GRID_COLOR }} />
            <Bar dataKey="value" name="عناصر" radius={[0, 6, 6, 0]}>
              {tags.map((entry, index) => (
                <Cell key={entry.label} fill={PALETTE[index % PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

export default InteractiveCharts;
