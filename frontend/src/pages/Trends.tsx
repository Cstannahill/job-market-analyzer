// Trends.tsx
import { useEffect, useState, useRef } from 'react';
import { Layout } from '../components/Layout';
import { Spinner } from '../components/ui/spinner';
import { Card, CardContent } from '../components/ui/card';
import { fetchTop, fetchSkill, type SkillTrend } from '../services/trends';
import SkillList from '../components/trends/SkillList';
import SkillDetailPanel from '../components/trends/SkillDetailPanel';

export default function Trends() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [skills, setSkills] = useState<SkillTrend[]>([]);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            try {
                setLoading(true);
                setError(null);
                const data = await fetchTop({ limit: 200 });
                if (!mounted) return;
                setSkills(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
            } finally {
                if (mounted) setLoading(false);
            }
        };
        load();
        return () => { mounted = false; };
    }, []);

    const [selected, setSelected] = useState<SkillTrend | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState<string | null>(null);
    const [detail, setDetail] = useState<SkillTrend | null>(null);
    const [detailHistory, setDetailHistory] = useState<SkillTrend[]>([]);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [mobileVisible, setMobileVisible] = useState(false);
    const mobileCloseTimeoutRef = useRef<number | null>(null);
    useEffect(() => {
        return () => {
            if (mobileCloseTimeoutRef.current) {
                window.clearTimeout(mobileCloseTimeoutRef.current);
            }
        };
    }, []);

    const handleSelect = async (s: SkillTrend) => {
        setSelected(s);
        setDetail(null);
        setDetailError(null);
        setDetailLoading(true);
        try {
            const rows: SkillTrend[] = await fetchSkill(s.skill);
            setDetailHistory(rows);
            const match: SkillTrend | null =
                rows.find((r: SkillTrend) => r.region === s.region && r.seniority === s.seniority) || rows[0] || null;
            setDetail(match);
        } catch (err) {
            setDetailError(err instanceof Error ? err.message : String(err));
        } finally {
            setDetailLoading(false);
        }
    };

    return (
        <Layout>
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
                <div className="page-header py-8">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-white/95">Trends</h1>
                    <p className="mt-2 text-lg text-slate-400">Market demand, top skills and quick insights.</p>
                </div>

                {/* Grid: left = compact list (col-span-1), right = wide details (col-span-3) */}
                <div className="trends-grid md:grid md:grid-cols-4 gap-6 items-start">
                    {/* LEFT: single-column list/navigation */}
                    <div className="trends-main md:col-span-1">
                        <div className="sticky top-20">
                            <Card className="rounded-xl overflow-hidden bg-gradient-to-b from-slate-900/60 to-slate-900/50 border border-white/6">
                                <CardContent className="p-3">  {/* reduced padding */}
                                    <h2 className="text-lg text-center font-bold text-white mb-2">Top Skills</h2>

                                    {loading && (
                                        <div className="center-block py-6 flex flex-col items-center gap-3">
                                            <Spinner />
                                            <div className="text-sm text-slate-400">Loading trends...</div>
                                        </div>
                                    )}

                                    {!loading && !error && (
                                        <div className="mt-1">
                                            <SkillList skills={skills} onSelect={handleSelect} />
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    {/* RIGHT: Insight panel takes 3/4 of width */}
                    <aside className="trends-side md:col-span-3">
                        <div className="sticky top-20">
                            <Card className="h-full rounded-xl overflow-hidden border border-white/6 bg-gradient-to-br from-slate-900/60 to-slate-900/40 shadow-2xl">
                                <CardContent className="h-full flex flex-col p-5">
                                    <h3 className="text-2xl text-center my-2 font-semibold text-white">Insight Panel</h3>

                                    {detailLoading ? (
                                        <div className="center-block flex-1 flex flex-col items-center justify-center">
                                            <Spinner />
                                            <div className="text-sm text-slate-400 mt-3">Loading details...</div>
                                        </div>
                                    ) : detailError ? (
                                        <div className="text-sm text-red-500">{detailError}</div>
                                    ) : (
                                        <SkillDetailPanel skill={detail ?? selected} history={detailHistory} />
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </aside>


                    {/* Mobile drawer (unchanged) */}
                    <div className="md:hidden">
                        <button
                            className="mobile-insight-btn fixed bottom-6 right-6 bg-purple-600 text-white px-4 py-2 rounded-full shadow-lg"
                            onClick={() => {
                                setMobileVisible(true);
                                window.setTimeout(() => setMobileOpen(true), 10);
                            }}
                            aria-label="Open insights"
                        >
                            Insights
                        </button>
                        {mobileVisible && (
                            <>
                                <div
                                    className={`mobile-insight-overlay ${mobileOpen ? 'open' : ''} fixed inset-0 bg-black/40`}
                                    onClick={() => {
                                        setMobileOpen(false);
                                        mobileCloseTimeoutRef.current = window.setTimeout(() => setMobileVisible(false), 300);
                                    }}
                                />
                                <div className={`mobile-insight-drawer ${mobileOpen ? 'open' : ''} fixed bottom-0 left-0 right-0 bg-slate-900/95 p-4 rounded-t-xl shadow-xl`}>
                                    <div className="mobile-insight-header flex justify-between items-center mb-3">
                                        <div className="text-lg font-semibold text-white">Insights</div>
                                        <button className="close-btn text-slate-300" onClick={() => {
                                            setMobileOpen(false);
                                            mobileCloseTimeoutRef.current = window.setTimeout(() => setMobileVisible(false), 300);
                                        }}>Close</button>
                                    </div>
                                    <div className="mobile-insight-body">
                                        <SkillDetailPanel skill={detail ?? selected} history={detailHistory} />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    );
}
