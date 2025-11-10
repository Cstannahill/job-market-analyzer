// src/features/trends-v2/TechDetailPanel.tsx
import { ResponsiveContainer, XAxis, BarChart, Bar, YAxis, Tooltip as ReTooltip } from 'recharts';
import type { TechnologyDetailResponse } from '@/shared-types/src/trendsv2';
import { H2 } from '@/components/ui/typography';

interface CoTech {
    name: string;
    value: number;
}

interface DisplayCoTech extends CoTech {
    displayName?: string;
}

export default function TechDetailPanel({ data }: { data: TechnologyDetailResponse | null }) {
    if (!data) {
        return (
            <div className="flex items-center justify-center py-12 text-sm text-slate-400">
                Select a technology to view insights
            </div>
        );
    }

    const s = data.summary;
    const wm = data.by_work_mode ?? [];
    const sn = data.by_seniority ?? [];

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

    const co = Object.entries(data.cooccurring_skills ?? {}).map(([name, value]) => ({ name, value }));
    co.sort((a, b) => b.value - a.value);

    const displayCo: DisplayCoTech[] = co.map(ct => formatTechName(ct));

    // Group work_mode data by seniority for better display
    const workModeBySeniority = wm.reduce((acc, item) => {
        if (!acc[item.seniority]) {
            acc[item.seniority] = [];
        }
        acc[item.seniority].push(item);
        return acc;
    }, {} as Record<string, typeof wm>);

    const seniorityOrder = ['Senior', 'Mid', 'Lead', 'Junior', 'Unknown'];
    const sortedSeniorities = Object.keys(workModeBySeniority).sort(
        (a, b) => seniorityOrder.indexOf(a) - seniorityOrder.indexOf(b)
    );

    return (
        <div className="space-y-5">
            <H2 text="Insights Panel" style={{ fontSize: "1.5rem", margin: ".25rem" }} className="text-shadow-blue text-center col-start-2" />
            {/* Headline Stats - Now 4 columns with more stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Stat title="Demand" value={s?.job_count ?? 0} />
                <Stat title="p50 Salary" value={s?.salary_median} money />
                <Stat title="p75 Salary" value={s?.salary_p75} money />
                <Stat title="Market Share" value={Math.round((s?.regional_share ?? 0) * 1000) / 10} suffix="%" />
            </div>

            {/* Work Mode & Seniority + Co-occurring - Better proportions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Left: Work Mode & Seniority - Takes 2 columns on XL screens */}
                <div className="xl:col-span-2 space-y-4">
                    {/* By Work Mode - Now organized by seniority level */}
                    <div className="rounded-lg p-4 bg-slate-800/30 border border-slate-700/30">
                        <h5 className="text-sm font-medium text-slate-200 mb-3 text-center">By Work Mode & Seniority</h5>
                        <div className="space-y-3">
                            {sortedSeniorities.map(seniority => (
                                <div key={seniority}>
                                    <div style={{ fontWeight: "bolder", padding: ".25rem 0" }} className="text-sm text-slate-300 mb-2 font-mono text-center">{seniority}</div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-stretch">
                                        {workModeBySeniority[seniority].map(w => (
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
                        <h5 className="text-sm font-medium text-slate-200 mb-3 text-center">Seniority Distribution</h5>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {sn.map(w => (
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
                    <h5 className="text-sm font-medium text-slate-200 mb-4 text-center">Top Co-occurring</h5>
                    <div className="h-[500px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={displayCo.slice(0, 10)}
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
                                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                                    stroke="#334155"
                                />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    width={70}
                                    tick={{ fontSize: 11, fill: '#cbd5e1' }}
                                    stroke="#334155"
                                />
                                <ReTooltip
                                    contentStyle={{
                                        background: '#1e293b',
                                        border: '1px solid rgba(124,58,237,0.2)',
                                        borderRadius: '6px'
                                    }}
                                    itemStyle={{ color: '#e2e8f0' }}
                                    cursor={{ fill: 'rgba(124,58,237,0.1)' }}
                                />
                                <Bar
                                    dataKey="value"
                                    fill="url(#barGrad)"
                                    radius={[0, 4, 4, 0]}
                                    maxBarSize={20}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Stat({
    title,
    value,
    money = false,
    suffix
}: {
    title: string;
    value: unknown;
    money?: boolean;
    suffix?: string;
}) {
    const v = money ? `$${(value ?? 0).toLocaleString()}` : `${value ?? '—'}`;

    return (
        <div className="rounded-lg p-3 bg-slate-900/50 border border-slate-800 text-center">
            <div className="text-xs text-slate-400 mb-1">{title}</div>
            <div className="text-xl font-mono text-white">
                {v}{suffix ?? ''}
            </div>
        </div>
    );
}

function Badge({ label, v, sub }: { label: string; v: number; sub: string, className?: string }) {
    return (
        <div style={{ padding: ".25rem 0" }} className="rounded-md p-2 bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-colors text-center">
            <div className="text-xs text-slate-400 truncate">{label}</div>
            <div className="text-base font-mono text-white font-semibold">{v}</div>
            <div className="text-sm text-stone-400 truncate">{sub}</div>
        </div>
    );
}