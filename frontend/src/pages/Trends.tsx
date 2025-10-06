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
    // mobileVisible controls whether drawer is mounted (so we can animate on close)
    const [mobileVisible, setMobileVisible] = useState(false);
    // keep track of the close timeout so we can clear on unmount
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
            // Prefer an exact match for region+seniority if present
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
            <div className="page-header">
                <h1>Trends</h1>
                <p className="muted">Market demand, top skills and quick insights.</p>
            </div>

            {/* Adjusted grid: allocate 5/7 to main list, 2/7 to insight panel for wider card */}
            <div className="trends-grid md:grid md:grid-cols-7 gap-6 items-start">
                <div className="trends-main md:col-span-5">
                    <Card>
                        <CardContent>
                            <h2>Top Skills</h2>
                            {loading && (
                                <div className="center-block">
                                    <Spinner />
                                    <div>Loading trends...</div>
                                </div>
                            )}

                            {error && (
                                <div className="error text-red-600">
                                    <h3>Error</h3>
                                    <p>{error}</p>
                                </div>
                            )}

                            {!loading && !error && (
                                <SkillList skills={skills} onSelect={handleSelect} />
                            )}
                        </CardContent>
                    </Card>
                </div>

                <aside className="trends-side md:col-span-2">
                    <Card className="h-full">
                        <CardContent className="h-full flex flex-col">
                            <h3 className="mb-2">Insight Panel</h3>
                            {detailLoading ? (
                                <div className="center-block flex-1">
                                    <Spinner />
                                    <div>Loading details...</div>
                                </div>
                            ) : detailError ? (
                                <div className="text-sm text-red-600">{detailError}</div>
                            ) : (
                                <SkillDetailPanel skill={detail ?? selected} history={detailHistory} />
                            )}
                        </CardContent>
                    </Card>
                </aside>

                {/* Mobile-only floating button to open insight drawer */}
                <div className="md:hidden">
                    <button
                        className="mobile-insight-btn"
                        onClick={() => {
                            // mount then open to allow enter animation
                            setMobileVisible(true);
                            // small delay ensures class application
                            window.setTimeout(() => setMobileOpen(true), 10);
                        }}
                        aria-label="Open insights"
                    >
                        Insights
                    </button>
                    {mobileVisible && (
                        <>
                            <div
                                className={`mobile-insight-overlay ${mobileOpen ? 'open' : ''}`}
                                onClick={() => {
                                    setMobileOpen(false);
                                    // delay unmount to allow animation
                                    mobileCloseTimeoutRef.current = window.setTimeout(() => setMobileVisible(false), 300);
                                }}
                            />
                            <div className={`mobile-insight-drawer ${mobileOpen ? 'open' : ''}`} role="dialog" aria-modal="true">
                                <div className="mobile-insight-header">
                                    <button className="close-btn" onClick={() => {
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
        </Layout>
    );
}
