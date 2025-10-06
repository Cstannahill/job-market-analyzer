import { useEffect, useState } from 'react';
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
            </div>
        </Layout>
    );
}
