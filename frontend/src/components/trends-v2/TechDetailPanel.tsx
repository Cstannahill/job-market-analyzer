import { lazy, Suspense } from "react";
import type { TechnologyDetailResponse } from "@job-market-analyzer/types/trendsv2";
import { H2 } from "@/components/ui/typography";

const CooccurringChart = lazy(() => import("./CooccurringChart"));

interface CoTech {
  name: string;
  value: number;
}

interface DisplayCoTech extends CoTech {
  displayName?: string;
}

export default function TechDetailPanel({
  data,
}: {
  data: TechnologyDetailResponse | null;
}) {
  if (!data) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-slate-400">
        Select a technology to view insights
      </div>
    );
  }

  const s = data.summary;
  const ALLOWED_SENIORITIES = ["Junior", "Mid", "Senior", "Lead"];
  const wm = (data.by_work_mode ?? []).filter((item) =>
    ALLOWED_SENIORITIES.includes(item.seniority),
  );
  const sn = (data.by_seniority ?? [])
    .filter((item) => ALLOWED_SENIORITIES.includes(item.level))
    .sort(
      (a, b) =>
        ALLOWED_SENIORITIES.indexOf(a.level) -
        ALLOWED_SENIORITIES.indexOf(b.level),
    );

  const formatTechName = (coTech: CoTech): DisplayCoTech => {
    const { name } = coTech;
    const displayTech: DisplayCoTech = { ...coTech };

    const parts = name.includes(" ")
      ? name.split(" ")
      : name.includes("-")
        ? name.split("-")
        : null;

    if (!parts) {
      const newName = name.length >= 7 ? name.slice(0, 7) : name;
      if (newName) {
        displayTech.displayName = newName;
      }
    }

    return displayTech;
  };

  const co = Object.entries(data.cooccurring_skills ?? {}).map(
    ([name, value]) => ({ name, value }),
  );
  co.sort((a, b) => b.value - a.value);

  const displayCo: DisplayCoTech[] = co.map((ct) => formatTechName(ct));

  const workModeBySeniority = wm.reduce(
    (acc, item) => {
      if (!acc[item.seniority]) {
        acc[item.seniority] = [];
      }
      acc[item.seniority].push(item);
      return acc;
    },
    {} as Record<string, typeof wm>,
  );

  const seniorityOrder = ALLOWED_SENIORITIES;
  const sortedSeniorities = Object.keys(workModeBySeniority).sort(
    (a, b) => seniorityOrder.indexOf(a) - seniorityOrder.indexOf(b),
  );

  return (
    <div style={{ padding: ".25rem .25rem" }} className="space-y-5">
      <H2
        text="Insights Panel"
        style={{ fontSize: "1.5rem", margin: ".25rem" }}
        className="text-shadow-blue text-center col-start-2"
      />
      {/* Headline Stats - Now 4 columns with more stats */}
      <div
        style={{ margin: ".5rem" }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
      >
        <Stat title="Demand" value={s?.job_count ?? 0} />
        <Stat title="p50 Salary" value={s?.salary_median} money />
        <Stat title="p75 Salary" value={s?.salary_p75} money />
        <Stat
          title="Market Share"
          value={Math.round((s?.regional_share ?? 0) * 1000) / 10}
          suffix="%"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-4">
          <div className="rounded-lg p-4 bg-slate-800/30 border border-slate-700/30">
            <h3 style={{ fontSize: "1.1rem" }} className="text-sm font-medium text-slate-200 mb-3 text-center">
              By Work Mode & Seniority
            </h3>
            <div className="space-y-3">
              {sortedSeniorities.map((seniority) => (
                <div key={seniority}>
                  <div
                    style={{ fontWeight: "bolder", padding: ".25rem 0" }}
                    className="text-sm text-slate-300 mb-2 font-mono text-center"
                  >
                    {seniority}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-stretch">
                    {workModeBySeniority[seniority].map((w) => (
                      <Badge
                        key={`${w.work_mode}-${w.seniority}-${w.job_count}`}
                        label={w.work_mode}
                        v={w.job_count}
                        sub={`p50 $${(w.salary_median ?? 0).toLocaleString()}`}
                        className="h-full"
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* By Seniority Totals */}
          <div className="rounded-lg p-4 bg-slate-800/30 border border-slate-700/30">
            <h3 style={{ fontSize: "1.1rem" }} className="text-sm font-medium text-slate-200 mb-3 text-center">
              Seniority Distribution
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {sn.map((w) => (
                <Badge
                  key={`${w.level}-${w.job_count}-${w.salary_median}`}
                  label={w.level}
                  v={w.job_count}
                  sub={`p50 $${(w.salary_median ?? 0).toLocaleString()}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right: Co-occurring Technologies */}
        <div className="rounded-lg p-5 bg-slate-800/30 border border-slate-700/30">
          <h3 style={{ fontSize: "1.1rem" }} className="text-sm font-medium text-slate-200 mb-4 text-center">
            Top Co-occurring
          </h3>
          <div className="h-[500px] lg:h-[90%]">
            <Suspense fallback={<ChartSkeleton />}>
              <CooccurringChart data={displayCo.slice(0, 10)} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="h-full w-full animate-pulse rounded-lg bg-slate-800/30 border border-slate-700/30" />
  );
}

function Stat({
  title,
  value,
  money = false,
  suffix,
}: {
  title: string;
  value: unknown;
  money?: boolean;
  suffix?: string;
}) {
  const v = money ? `$${(value ?? 0).toLocaleString()}` : `${value ?? "—"}`;

  return (
    <div className="rounded-lg p-3 bg-slate-900/50 border border-slate-800 text-center">
      <div className="text-xs text-slate-400 mb-1">{title}</div>
      <div className="text-xl font-mono text-white">
        {v}
        {suffix ?? ""}
      </div>
    </div>
  );
}

function Badge({
  label,
  v,
  sub,
}: {
  label: string;
  v: number;
  sub: string;
  className?: string;
}) {
  return (
    <div
      style={{ padding: ".25rem 0" }}
      className="rounded-md p-2 bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-colors text-center"
    >
      <div className="text-xs text-slate-400 truncate">{label}</div>
      <div className="text-base font-mono text-white font-semibold">{v}</div>
      <div className="text-sm text-stone-300 truncate">{sub}</div>
    </div>
  );
}
