import { useMemo, useState } from 'react';
import { type SkillTrend } from '../../services/trends';
import { Card, CardContent } from '../ui/card';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip as ReTooltip,
    LineChart,
    Line,
    AreaChart,
    Area,
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { HiOutlineDownload, HiOutlineClipboardCopy } from 'react-icons/hi';
import { toProperCase } from '@/lib/stringHelpers';

type Props = {
    skill: SkillTrend | null;
    history?: SkillTrend[];
};

function formatCurrency(n?: number | null) {
    if (n == null) return 'N/A'; // handles null or undefined
    const rounded = Math.round(n);
    return `$${rounded.toLocaleString()}`;
}

function toCSV(rows: string[][]) {
    return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}

function percentChange(oldVal = 0, newVal = 0) {
    if (oldVal === 0 && newVal === 0) return 0;
    if (oldVal === 0) return 100;
    return ((newVal - oldVal) / Math.abs(oldVal)) * 100;
}

export default function SkillDetailPanel({ skill, history = [] }: Props) {
    // hooks must be declared unconditionally (always)
    const [sortBy, setSortBy] = useState<'value' | 'name'>('value');
    const [copied, setCopied] = useState(false);

    // co-occurring skills array limited & sorted (safe if skill is null)
    const cooccurring = useMemo(() => {
        const raw = Object.entries(skill?.cooccurringSkills ?? {}).map(([name, value]) => ({
            name,
            value,
        }));
        if (sortBy === 'value') raw.sort((a, b) => b.value - a.value);
        else raw.sort((a, b) => a.name.localeCompare(b.name));
        return raw.slice(0, 8);
    }, [skill?.cooccurringSkills, sortBy]);

    // spark/trend data (ensure chronological order), safe when history empty
    const sparkData = useMemo(() => {
        const mapped = (history || []).map((h) => ({
            date: h.lastUpdated ?? '',
            count: typeof h.count === 'number' ? h.count : 0,
        }));
        mapped.sort((a, b) => (a.date > b.date ? 1 : -1));
        return mapped;
    }, [history]);

    // compute percent change comparing latest two points
    const trendChange = useMemo(() => {
        if (sparkData.length < 2) return 0;
        const prev = sparkData[sparkData.length - 2].count;
        const latest = sparkData[sparkData.length - 1].count;
        return Math.round(percentChange(prev, latest));
    }, [sparkData]);

    // last updated string (safe even when skill null)
    const lastUpdated = skill?.lastUpdated ?? (sparkData.length ? sparkData[sparkData.length - 1].date : '');

    // CSV export handler (guarded to require skill)
    function exportCSV() {
        if (!skill) return;
        const rows: string[][] = [];
        rows.push(['Skill', skill.skill ?? '']);
        rows.push([]);
        rows.push(['Trend Date', 'Count']);
        sparkData.forEach((d) => rows.push([d.date, String(d.count)]));
        rows.push([]);
        rows.push(['Co-occurring Skill', 'Count']);
        Object.entries(skill.cooccurringSkills ?? {}).forEach(([k, v]) => rows.push([k, String(v)]));
        const csv = toCSV(rows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${skill.skill ?? 'skill'}-trend.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    // copy skill name (guarded)
    async function copySkill() {
        if (!skill) return;
        try {
            await navigator.clipboard.writeText(skill.skill ?? '');
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            setCopied(false);
        }
    }

    const barData = cooccurring.map((c) => ({ name: c.name, value: c.value }));

    // If no skill selected, show a small placeholder (hooks still declared above)
    if (!skill) return <div className="text-sm text-slate-400">No skill selected.</div>;

    // --- UI (same as before, now type-safe) ---
    return (
        <Card className="h-full bg-slate-900/60 ring-1 ring-slate-800">
            <CardContent className="pt-3 pb-4 px-4 sm:px-5 h-full flex flex-col gap-4">
                {/* HEADER */}
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg">
                            <span className="text-white font-extrabold uppercase select-none">{(skill.skill || '').slice(0, 2)}</span>
                        </div>
                        <div>
                            <h4 className="text-lg sm:text-xl font-extrabold text-white leading-tight">{skill && skill.skill && skill.skill.length > 3 ? toProperCase(skill.skill) : skill.skill.toUpperCase()}</h4>
                            <div className="text-xs text-slate-400 mt-1 flex gap-2 items-center">
                                <span>{skill.region || 'global'}</span>
                                <span>·</span>
                                <span>{skill.seniority || 'all'}</span>
                                {lastUpdated ? (
                                    <>
                                        <span className="hidden sm:inline">·</span>
                                        <span className="text-[11px] text-slate-500 ml-0.5">Last: {lastUpdated}</span>
                                    </>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                        <div className="text-xs text-slate-400">Demand</div>
                        <div className="flex items-center gap-3">
                            <motion.div
                                key={skill.count}
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.35 }}
                                className="text-lg font-mono font-semibold text-white"
                            >
                                {skill.count ?? 0}
                            </motion.div>

                            <div className="flex items-center gap-2">
                                <div
                                    className={`px-2 py-0.5 rounded-md text-xs font-medium ${trendChange > 0 ? 'bg-emerald-700/40 text-emerald-200' : trendChange < 0 ? 'bg-rose-700/30 text-rose-200' : 'bg-slate-700/40 text-slate-300'
                                        }`}
                                >
                                    {trendChange > 0 ? `+${trendChange}%` : `${trendChange}%`}
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={copySkill}
                                        title="Copy skill name"
                                        className="p-1 rounded-md hover:bg-slate-800/40"
                                    >
                                        <HiOutlineClipboardCopy className="text-slate-300" />
                                    </button>
                                    <button
                                        onClick={exportCSV}
                                        title="Export CSV"
                                        className="p-1 rounded-md hover:bg-slate-800/40"
                                    >
                                        <HiOutlineDownload className="text-slate-300" />
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">Remote: <span className="text-slate-300 font-medium">{skill.remotePercentage ?? 0}%</span></div>
                    </div>
                </div>

                {/* STAT CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-slate-800/30 rounded-md px-3 py-2 flex flex-col">
                        <div className="text-xs text-slate-400">Avg Salary</div>
                        <div className="mt-1 text-lg font-mono text-white">{formatCurrency(skill.avgSalary)}</div>
                        <div className="text-[12px] text-slate-400 mt-2">{skill.topIndustries?.length ? 'Top industries' : 'No industry data'}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {skill.topIndustries?.slice(0, 4).map((t) => (
                                <span key={t} className="text-xs bg-white/4 px-2 py-1 rounded-md text-slate-100">{t}</span>
                            )) ?? <div className="text-sm text-slate-400">—</div>}
                        </div>
                    </div>

                    <div className="bg-slate-800/30 rounded-md px-3 py-2 flex items-center justify-between">
                        <div>
                            <div className="text-xs text-slate-400">Recent trend</div>
                            <div className="mt-1 text-sm font-medium text-slate-200">{sparkData.length ? `${sparkData[sparkData.length - 1].count} (latest)` : 'No data'}</div>
                            <div className="text-[11px] text-slate-400 mt-1">Points: {sparkData.length}</div>
                        </div>
                        <div className="w-36 h-16">
                            {sparkData.length >= 2 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={sparkData}>
                                        <defs>
                                            <linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.9} />
                                                <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.06} />
                                            </linearGradient>
                                        </defs>
                                        <Area type="monotone" dataKey="count" stroke="#7c3aed" strokeWidth={2} fill="url(#sparkGradient)" dot={false} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="text-xs text-slate-400">No trend</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* MAIN BODY: Trend chart + co-occurring */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start flex-1">
                    {/* Trend (big) */}
                    <div className="lg:col-span-2 bg-slate-800/30 rounded-md p-3">
                        <div className="flex items-center justify-between">
                            <h5 className="text-sm font-medium text-slate-200">Trend (counts)</h5>
                            <div className="text-xs text-slate-400">{lastUpdated ? `Last: ${lastUpdated}` : ''}</div>
                        </div>

                        <div className="mt-2 h-44 -mx-3">
                            {sparkData.length >= 2 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={sparkData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="lineGradient" x1="0" x2="0" y1="0" y2="1">
                                                <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.9} />
                                                <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.06} />
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="date" hide />
                                        <ReTooltip
                                            contentStyle={{ background: '#0f1724', border: '1px solid rgba(124,58,237,0.12)' }}
                                            itemStyle={{ color: '#e6e7ee' }}
                                        />
                                        <Line type="monotone" dataKey="count" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-sm text-slate-400">No trend data.</div>
                            )}
                        </div>
                    </div>

                    {/* Co-occurring */}
                    <div className="bg-slate-800/30 rounded-md p-3 flex flex-col">
                        <div className="flex items-center justify-between">
                            <h5 className="text-sm font-medium text-slate-200">Top co-occurring skills</h5>
                            <div className="flex items-center gap-2">
                                <div className="text-xs text-slate-400">Sort</div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setSortBy('value')}
                                        className={`text-xs px-2 py-0.5 rounded-md ${sortBy === 'value' ? 'bg-indigo-600/60 text-white' : 'text-slate-300'}`}
                                    >
                                        Value
                                    </button>
                                    <button
                                        onClick={() => setSortBy('name')}
                                        className={`text-xs px-2 py-0.5 rounded-md ${sortBy === 'name' ? 'bg-indigo-600/60 text-white' : 'text-slate-300'}`}
                                    >
                                        Name
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="mt-3 flex-1">
                            {barData.length === 0 ? (
                                <p className="text-sm text-slate-400">No co-occurrence data.</p>
                            ) : (
                                <div className="h-48 -mx-2">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
                                            <defs>
                                                <linearGradient id="barGrad" x1="0" x2="1" y1="0" y2="0">
                                                    <stop offset="0%" stopColor="#7c3aed" stopOpacity={1} />
                                                    <stop offset="100%" stopColor="#4f46e5" stopOpacity={1} />
                                                </linearGradient>
                                            </defs>
                                            <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                            <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 12, fill: '#cbd5e1' }} />
                                            <ReTooltip
                                                contentStyle={{ background: '#0b1220', border: '1px solid rgba(124,58,237,0.12)' }}
                                                itemStyle={{ color: '#e6e7ee' }}
                                            />
                                            <Bar dataKey="value" fill="url(#barGrad)" radius={[6, 6, 6, 6]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>

                        <div className="mt-3">
                            <div className="flex gap-2 flex-wrap">
                                {barData.slice(0, 3).map((b) => (
                                    <span key={b.name} className="text-xs bg-white/4 px-2 py-1 rounded-md text-slate-100">
                                        {b.name} <span className="text-slate-300 ml-1">({b.value})</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* footer small */}
                <div className="text-xs text-slate-500">
                    <span>Source: aggregated job postings · </span>
                    <span className="ml-1">Updated: {lastUpdated || '—'}</span>
                </div>

                {/* copy feedback */}
                <AnimatePresence>
                    {copied && (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 8 }}
                            className="fixed bottom-6 right-6 bg-slate-800/80 text-white px-3 py-2 rounded-md text-sm shadow-lg"
                        >
                            Copied skill name
                        </motion.div>
                    )}
                </AnimatePresence>
            </CardContent>
        </Card>
    );
}
