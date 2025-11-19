// src/features/trends-v2/TrendsV2Page.tsx
import { useEffect, useMemo, useState } from 'react';
import { getTop, getRising, getTechDetail } from '@/services/trendsv2Service';
import FiltersBar from '@/components/trends-v2/FiltersBar';
import TopList from '@/components/trends-v2/TopList';
import RisingGrid from '@/components/trends-v2/RisingGrid';
import TechDetailPanel from '@/components/trends-v2/TechDetailPanel';
import type { Region, Period, TopTechnologiesItem, TechnologyDetailResponse, WeekPeriod } from '@job-market-analyzer/types/trendsv2';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendsLayout } from '@/components/TrendsLayout';
import { toWeek } from '@/lib/utils/dateUtils';
import useIsMobile from '@/hooks/useIsMobile';
import Seo from '@/components/Seo';


const today = new Date();
const thisWeek: WeekPeriod = toWeek(today);
const weekNumb = Number(thisWeek.split("W")[1]);
const lastWeek = weekNumb - 1
const trendWeek = thisWeek.split("W")[0] + "W" + lastWeek as WeekPeriod
const DEFAULT_REGION: Region = "GLOBAL";
const DEFAULT_PERIOD: Period = trendWeek;
console.log(thisWeek)

export default function TrendsV2Page() {
    const [region, setRegion] = useState<Region>(DEFAULT_REGION);
    const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
    const isMobile = useIsMobile();

    const [top, setTop] = useState<TopTechnologiesItem[]>([]);
    const [rising, setRising] = useState<TopTechnologiesItem[]>([]);
    const [detail, setDetail] = useState<TechnologyDetailResponse | null>(null);
    const [selected, setSelected] = useState<TopTechnologiesItem | null>(null);
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        let live = true;
        (async () => {
            setLoading(true);
            try {
                const [topData, risingData] = await Promise.all([
                    getTop({ region, period, limit: 50 }),
                    getRising({ region, period, limit: 18 }),
                ]);
                if (!live) return;
                setTop(topData);
                setRising(risingData);
                // select first by default
                if (topData[0]) {
                    const det = await getTechDetail({ name: topData[0].skill_canonical, region, period });
                    if (!live) return;
                    setSelected(topData[0]);
                    setDetail(det);
                } else {
                    setSelected(null);
                    setDetail(null);
                }
            } finally {
                if (live) setLoading(false);
            }
        })();
        return () => { live = false; };
    }, [region, period]);

    async function pick(it: TopTechnologiesItem) {
        setSelected(it);
        setDetail(null);
        const det = await getTechDetail({ name: it.skill_canonical, region, period });
        setDetail(det);
    }

    // Prepare sidebar content
    const sidebarContent = <TopList data={top} onSelect={pick} selected={selected} />;
    const selectedSkill = selected?.skill_canonical ?? '';
    const mobileOptions = useMemo(
        () =>
            top.map((item) => ({
                label: `${item.skill_canonical} • Demand ${item.job_count ?? 0}`,
                value: item.skill_canonical,
            })),
        [top]
    );

    if (loading) {
        return (
            <TrendsLayout>
                <Seo
                    title="Technology Trends – Job Market Analyzer"
                    description="Track rising technologies and regional demand signals across the job market."
                    path="trends"
                    image="/public/og/trends.avif"
                />
                <div className="flex flex-col items-center justify-center h-screen gap-4">
                    <Spinner className="size-8" />
                    <p className="text-slate-400">Loading Technology Trends...</p>
                    <div className="w-full max-w-6xl px-4">
                        <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-1 gap-4">
                            <Skeleton className="h-56" />
                            <Skeleton className="h-56" />
                            <Skeleton className="h-56" />
                        </div>
                    </div>
                </div>
            </TrendsLayout>
        );
    }

    return (
        <TrendsLayout
            sidebarContent={sidebarContent}
            sidebarTitle="Top Technologies"
        >
            <Seo
                title="Technology Trends – Job Market Analyzer"
                description="Discover top and rising technologies along with demand, salaries, and co-occurring skill insights."
                path="trends"
                image="/public/og/trends.avif"
            />
            <div className='container'>
                {/* Filters - Full width */}
                <div className="sticky top-20 sm:top-0 z-20 border-b border-white/5 bg-slate-900/40 backdrop-blur">
                    <div style={{ padding: ".25rem" }} className="flex justify-center py-3">
                        <FiltersBar
                            region={region}
                            period={period}
                            onChange={({ region, period }) => {
                                setRegion(region);
                                setPeriod(period);
                            }}
                        />
                    </div>
                    {isMobile && mobileOptions.length > 0 && (
                        <div className="px-4 pb-3">
                            <label className="text-xs uppercase tracking-wide text-slate-300 block mb-2">
                                Select Technology
                            </label>
                            <select
                                className="w-full rounded-lg bg-slate-900 text-white border border-white/15 px-3 py-2 text-sm"
                                value={selectedSkill}
                                onChange={(e) => {
                                    const pickItem = top.find(
                                        (t) => t.skill_canonical === e.target.value
                                    );
                                    if (pickItem) {
                                        pick(pickItem);
                                    }
                                }}
                            >
                                {mobileOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* Main Content - Full width, no containers */}
                <div className="p-6 space-y-6">
                    {/* Rising Technologies Section */}
                    <section className="rounded-lg bg-slate-900/50 border border-white/10 p-5">

                        <RisingGrid data={rising} />
                    </section>

                    {/* Insights Panel */}
                    <section className="rounded-lg bg-slate-900/50 border border-white/10 p-5">

                        <TechDetailPanel data={detail} />
                    </section>
                </div>
            </div>
        </TrendsLayout>
    );
}
