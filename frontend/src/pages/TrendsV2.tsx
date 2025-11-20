import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type {
    Region,
    Period,
    TopTechnologiesItem,
    TechnologyDetailResponse,
    WeekPeriod,
} from "@job-market-analyzer/types/trendsv2";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { toWeek } from "@/lib/utils/dateUtils";
import Seo from "@/components/Seo";
import { useTrendsV2Data } from "@/hooks/useTrendsV2Data";
import {
    TrendsV2Controls,
} from "@/components/trends-v2/TrendsV2Controls";
import type {
    TechOption,
    TechSearchValue,
} from "@/components/postings/TechSearchCombobox";

const RisingGrid = lazy(() => import("@/components/trends-v2/RisingGrid"));
import TechDetailPanel from "@/components/trends-v2/TechDetailPanel";
import { Layout } from "@/components/Layout";

const today = new Date();
const thisWeek: WeekPeriod = toWeek(today);
const weekNumber = Number(thisWeek.split("W")[1]);
const lastWeek = weekNumber - 1;
const trendWeek = `${thisWeek.split("W")[0]}W${lastWeek}` as WeekPeriod;
const DEFAULT_REGION: Region = "GLOBAL";
const DEFAULT_PERIOD: Period = trendWeek;

export default function TrendsV2Page() {
    const {
        region,
        weeks,
        setRegion,
        period,
        setPeriod,
        top,
        rising,
        selected,
        detail,
        selectTech,
        loading,
        detailLoading,
    } = useTrendsV2Data({
        initialRegion: DEFAULT_REGION,
        initialPeriod: DEFAULT_PERIOD,
    });

    const [techSearch, setTechSearch] = useState<TechSearchValue>({
        tech: null,
        query: "",
    });

    useEffect(() => {
        setTechSearch({
            tech: selected?.skill_canonical ?? null,
            query: "",
        });
    }, [selected?.skill_canonical]);

    useEffect(() => {
        if (detailLoading) {
            void import("@/components/trends-v2/CooccurringChart");
        }
    }, [detailLoading]);

    const techOptions = useMemo<TechOption[]>(() => {
        return top.map((item) => ({
            value: item.skill_canonical,
            label: item.skill_canonical,
            count: item.job_count,
        }));
    }, [top]);

    const handleFiltersChange = ({ region, period }: { region: Region; period: Period }) => {
        setRegion(region);
        setPeriod(period);
    };

    const handleTechCommit = (next: TechSearchValue) => {
        setTechSearch(next);
        if (next.tech) {
            const match = top.find(
                (item) => item.skill_canonical === next.tech
            );
            selectTech(match ?? top[0] ?? null);
            return;
        }
        selectTech(top[0] ?? null);
    };

    const handleTechChange = (next: TechSearchValue) => {
        setTechSearch(next);
    };

    if (loading) {
        return (
            <Layout>
                <Seo
                    title="Technology Trends | Job Market Analyzer"
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
            </Layout>
        );
    }

    return (
        <Layout>
            <Seo
                title="Technology Trends | Job Market Analyzer"
                description="Discover top and rising technologies along with demand, salaries, and co-occurring skill insights."
                path="trends"
                image="/public/og/trends.avif"
            />
            <div>
                <TrendsV2Controls
                    region={region}
                    weeks={weeks}
                    period={period}
                    onFiltersChange={handleFiltersChange}
                    techValue={techSearch}
                    onTechChange={handleTechChange}
                    onTechCommit={handleTechCommit}
                    techOptions={techOptions}
                    disabled={!top.length}
                />

                <div className="p-6 space-y-6">
                    <RisingSection data={rising} />
                    <DetailSection detail={detail} loading={detailLoading} />


                </div>
            </div>
        </Layout>
    );
}

function RisingSection({ data }: { data: TopTechnologiesItem[] }) {
    return (
        <section className="rounded-lg bg-slate-900/50 border border-white/10 p-5 min-h-96">
            <Suspense fallback={<RisingGridSkeleton />}>
                <RisingGrid data={data} />
            </Suspense>
        </section>
    );
}

function DetailSection({
    detail,

}: {
    detail: TechnologyDetailResponse | null;
    loading: boolean;
}) {
    return (
        <section className="rounded-lg bg-slate-900/50 border border-white/10 p-5 min-h-144">
            {/* {detail && !loading ? ( */}
            <Suspense fallback={<DetailPanelSkeleton />}>
                <TechDetailPanel data={detail} />
            </Suspense>
            {/* ) : (
                <DetailPanelSkeleton loading={loading} />
            )} */}
        </section>
    );
}

function RisingGridSkeleton() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, idx) => (
                <Skeleton key={`rise-${idx}`} className="h-28 w-full rounded-lg bg-white/5" />
            ))}
        </div>
    );
}

function DetailPanelSkeleton({ loading = true }: { loading?: boolean }) {
    return (
        <div className="space-y-4 min-h-144">
            <Skeleton className="h-8 w-64 mx-auto rounded-lg bg-white/5" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, idx) => (
                    <Skeleton key={`stat-${idx}`} className="h-20 w-full rounded-lg bg-white/5" />
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <Skeleton className="h-72 w-full rounded-lg bg-white/5 lg:col-span-2" />
                <Skeleton className="h-72 w-full rounded-lg bg-white/5" />
            </div>
            {loading && (
                <div className="flex items-center justify-center pt-2 text-sm text-slate-400">
                    <Spinner className="size-4 mr-2" />
                    Loading insights
                </div>
            )}
        </div>
    );
}
