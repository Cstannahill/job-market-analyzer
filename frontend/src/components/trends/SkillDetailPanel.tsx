import { type SkillTrend } from '../../services/trends';
import { Card, CardContent } from '../ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line } from 'recharts';

type Props = {
    skill: SkillTrend | null;
    history?: SkillTrend[];
};

export default function SkillDetailPanel({ skill, history = [] }: Props) {
    if (!skill) return <div className="text-sm text-slate-400">No skill selected.</div>;

    const data = Object.entries(skill.cooccurringSkills || {}).map(([k, v]) => ({ name: k, value: v })).slice(0, 8);
    const sparkData = (history || []).map((h) => ({ date: h.lastUpdated ?? '', count: typeof h.count === 'number' ? h.count : 0 }));

    return (
        <Card className="h-full bg-slate-900/50">
            <CardContent className="pt-3 pb-4 px-4 sm:px-5">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h4 className="text-lg sm:text-xl font-extrabold text-white">{skill.skill}</h4>
                        <p className="text-xs text-slate-400 mt-1">{skill.region || 'global'} · {skill.seniority || 'all'}</p>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-slate-400">Demand</div>
                        <div className="text-lg font-mono font-semibold text-white">{skill.count}</div>
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4">
                    <div className="flex gap-3">
                        <div className="flex-1 bg-slate-800/50 rounded-md px-3 py-2">
                            <div className="text-xs text-slate-400">Avg Salary</div>
                            <div className="mt-1 text-lg font-mono text-white">{skill.avgSalary ? `$${skill.avgSalary.toLocaleString()}` : 'N/A'}</div>
                        </div>
                        <div className="w-36 bg-slate-800/50 rounded-md px-3 py-2">
                            <div className="text-xs text-slate-400">Remote</div>
                            <div className="mt-1 text-lg font-semibold text-white">{skill.remotePercentage}%</div>
                        </div>
                    </div>

                    <div>
                        <h5 className="text-sm font-medium text-slate-200">Top industries</h5>
                        {skill.topIndustries && skill.topIndustries.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                                {skill.topIndustries.slice(0, 6).map((t) => (
                                    <span key={t} className="text-xs bg-white/3 px-2 py-1 rounded-md text-slate-100">{t}</span>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-slate-400">No industry data.</div>
                        )}
                    </div>

                    <div>
                        <h5 className="text-sm font-medium text-slate-200">Trend (counts)</h5>
                        {sparkData.length >= 2 ? (
                            <div className="mt-2 h-28 -mx-4 sm:-mx-5 px-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={sparkData} margin={{ left: 8, right: 8, top: 4, bottom: 0 }}>
                                        <XAxis dataKey="date" hide />
                                        <Tooltip />
                                        <Line type="monotone" dataKey="count" stroke="#7c3aed" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="text-sm text-slate-400">No trend data.</div>
                        )}
                    </div>

                    <div>
                        <h5 className="text-sm font-medium text-slate-200">Top co-occurring skills</h5>
                        {data.length === 0 ? (
                            <p className="text-sm text-slate-400">No co-occurrence data.</p>
                        ) : (
                            <div className="mt-2 h-48 -mx-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={data} layout="vertical" margin={{ left: 4, right: 4 }}>
                                        <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                        <YAxis dataKey="name" type="category" width={90} interval={0} tick={{ fontSize: 11, fill: '#cbd5e1' }} />
                                        <Tooltip />
                                        <Bar dataKey="value" fill="#7c3aed" radius={[4, 4, 4, 4]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
