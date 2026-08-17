"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis
} from "recharts";
import type { AppDictionary } from "@/lib/i18n/dictionaries";

const chartColors = [
  "var(--color-brand-primary)",
  "var(--color-brand-indigo)",
  "var(--color-brand-gold)",
  "var(--color-accent-rose)",
  "var(--color-status-success)",
  "var(--color-status-warning)"
];

type AnalyticsCopy = AppDictionary["pages"]["analytics"];

/**
 * V3-PERF-004: recharts (plus its d3-scale/d3-shape dependencies) is the
 * single heaviest import on the analytics route. Isolating both charts in
 * this module lets `next/dynamic` split them into a separate chunk that
 * loads in parallel with the records query instead of blocking initial
 * hydration of the page shell. Two named exports (rather than one
 * default) so each chart keeps its own place in the page layout while
 * still sharing one recharts chunk.
 */
export function MonthlyGrowthChart({
  copy,
  monthlyGrowth
}: Readonly<{ copy: AnalyticsCopy; monthlyGrowth: Array<{ month: string; count: number }> }>) {
  return (
    <section className="panel analytics-chart analytics-recharts-panel" aria-label={copy.monthlyGrowthAriaLabel}>
      <div className="panel-title-row">
        <div>
          <h2>{copy.monthlyGrowth}</h2>
          <p>{copy.monthlyGrowthDescription}</p>
        </div>
        <span className="badge">{copy.monthCount.replace("{count}", String(monthlyGrowth.length))}</span>
      </div>
      <div className="analytics-recharts" role="img" aria-label={copy.monthlyGrowthChartAriaLabel}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={monthlyGrowth} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border-secondary)" vertical={false} />
            <XAxis dataKey="month" stroke="var(--color-text-tertiary)" tickLine={false} axisLine={false} />
            <YAxis stroke="var(--color-text-tertiary)" tickLine={false} axisLine={false} width={34} />
            <RechartsTooltip
              cursor={{ fill: "color-mix(in srgb, var(--color-brand-primary) 10%, transparent)" }}
              contentStyle={{
                background: "var(--color-bg-secondary)",
                border: "1px solid var(--color-border-secondary)",
                borderRadius: "var(--radius-lg)",
                color: "var(--color-text-primary)"
              }}
            />
            <Bar dataKey="count" name={copy.chartItems} fill="var(--color-brand-primary)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export function TypeDistributionChart({
  copy,
  typeChartData
}: Readonly<{ copy: AnalyticsCopy; typeChartData: Array<{ name: string; value: number }> }>) {
  return (
    <section className="panel analytics-chart analytics-recharts-panel" aria-label={copy.typeChartAriaLabel}>
      <div className="panel-title-row">
        <div>
          <h2>{copy.typeMap}</h2>
          <p>{copy.typeMapDescription}</p>
        </div>
        <span className="badge">{copy.typesCount.replace("{count}", String(typeChartData.length))}</span>
      </div>
      <div className="analytics-recharts" role="img" aria-label={copy.typePieChartAriaLabel}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={typeChartData} dataKey="value" nameKey="name" innerRadius="48%" outerRadius="74%" paddingAngle={3}>
              {typeChartData.map((entry, index) => (
                <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
              ))}
            </Pie>
            <Legend />
            <RechartsTooltip
              contentStyle={{
                background: "var(--color-bg-secondary)",
                border: "1px solid var(--color-border-secondary)",
                borderRadius: "var(--radius-lg)",
                color: "var(--color-text-primary)"
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
