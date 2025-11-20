import {
  ResponsiveContainer,
  XAxis,
  BarChart,
  Bar,
  YAxis,
  Tooltip as ReTooltip,
} from "recharts";

type ChartPoint = {
  name: string;
  value: number;
};

export default function CooccurringChart({ data }: { data: ChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 10, right: 20, top: 10, bottom: 10 }}
      >
        <defs>
          <linearGradient id="barGrad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity={1} />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity={1} />
          </linearGradient>
        </defs>
        <XAxis
          type="number"
          tick={{ fontSize: 12, fill: "#94a3b8" }}
          stroke="#334155"
        />
        <YAxis
          type="category"
          dataKey="name"
          width={70}
          tick={{ fontSize: 11, fill: "#cbd5e1" }}
          stroke="#334155"
        />
        <ReTooltip
          contentStyle={{
            background: "#1e293b",
            border: "1px solid rgba(124,58,237,0.2)",
            borderRadius: "6px",
          }}
          itemStyle={{ color: "#e2e8f0" }}
          cursor={{ fill: "rgba(124,58,237,0.1)" }}
        />
        <Bar
          dataKey="value"
          fill="url(#barGrad)"
          radius={[0, 4, 4, 0]}
          maxBarSize={20}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
