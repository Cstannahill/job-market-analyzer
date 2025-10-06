import { type SkillTrend } from '../../services/trends';
import { Card, CardContent } from '../ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line } from 'recharts';

type Props = {
    skill: SkillTrend | null;
    history?: SkillTrend[];
};

export default function SkillDetailPanel({ skill, history = [] }: Props) {
    if (!skill) return <div className="text-sm text-gray-500">No skill selected.</div>;

    const data = Object.entries(skill.cooccurringSkills || {}).map(([k, v]) => ({ name: k, value: v })).slice(0, 10);
    const sparkData = (history || []).map((h) => ({ date: h.lastUpdated ?? '', count: typeof h.count === 'number' ? h.count : 0 }));

    return (
        <Card className="h-full">
            <CardContent className="pt-2 pb-4 px-4 sm:px-5">
                <h4 className="text-lg font-semibold leading-tight">{skill.skill}</h4>
                <p className="text-xs text-gray-500">{skill.region || 'global'} · {skill.seniority || 'all'}</p>

                <div className="mt-3 grid grid-cols-1 gap-5">
                    <div className="space-y-1">
                        <h5 className="text-sm font-medium">Salary (avg)</h5>
                        <div className="text-lg font-mono">{skill.avgSalary ? `$${skill.avgSalary.toLocaleString()}` : 'N/A'}</div>
                    </div>

                    <div className="space-y-1">
                        <h5 className="text-sm font-medium">Top industries</h5>
                        {skill.topIndustries && skill.topIndustries.length > 0 ? (
                            <ul className="list-disc list-inside text-sm">
                                {skill.topIndustries.slice(0, 5).map((t) => (
                                    <li key={t}>{t}</li>
                                ))}
                            </ul>
                        ) : (
                            <div className="text-sm text-gray-400">No industry data.</div>
                        )}
                    </div>

                    <div>
                        <h5 className="text-sm font-medium">Trend (counts)</h5>
                        {sparkData.length >= 2 ? (
                            <div className="mt-2 h-28 -mx-4 sm:-mx-5 px-0">
                                {/* Full bleed sparkline */}
                                <div className="w-full h-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={sparkData} margin={{ left: 8, right: 8, top: 4, bottom: 0 }}>
                                            <XAxis dataKey="date" hide />
                                            <Tooltip />
                                            <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={false} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        ) : (
                            <div className="text-sm text-gray-400">No trend data.</div>
                        )}
                    </div>

                    <div>
                        <h5 className="text-sm font-medium">Top co-occurring skills</h5>
                        {data.length === 0 ? (
                            <p className="text-sm text-gray-400">No co-occurrence data.</p>
                        ) : (
                            <div className="mt-2 h-64 -mx-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={data} layout="vertical" margin={{ left: 4, right: 4 }}>
                                        <XAxis type="number" tick={{ fontSize: 10 }} />
                                        <YAxis dataKey="name" type="category" width={72} interval={0} tick={{ fontSize: 10 }} />
                                        <Tooltip />
                                        <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 4, 4]} />
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
