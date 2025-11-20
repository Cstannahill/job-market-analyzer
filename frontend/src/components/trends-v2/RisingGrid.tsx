// src/features/trends-v2/RisingGrid.tsx
import type { TopTechnologiesItem } from '@job-market-analyzer/types/trendsv2';
import React from "react";
import { toProperCase } from "@/lib/stringHelpers";
import { H2 } from '@/components/ui/typography';

const CARD_HEIGHT = 75;
const ROW_GAP = 4;

export default function RisingGrid({ data }: { data: TopTechnologiesItem[] }) {
    // const [isOpen, setIsOpen] = React.useState(true);
    const columns = useResponsiveColumns();
    const fallbackCount = Math.max(columns * 2, 6);
    const displayCount = data.length || fallbackCount;
    const rows = Math.max(1, Math.ceil(displayCount / columns));
    const reservedHeight = rows * CARD_HEIGHT + (rows - 1) * ROW_GAP;
    const fillerCount =
        data.length && data.length % columns !== 0
            ? columns - (data.length % columns)
            : 0;

    return (
        <div style={{ padding: ".5rem .5rem" }}>
            <div className="nf-mono text-sm mb-2 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                <H2 text="Rising This Period" style={{ fontSize: "1.45rem" }} className="text-shadow-green text-center col-start-1 md:col-start-2" />
                <div className='flex justify-end col-start-3'>
                </div>
            </div>
            <div
                id="rising-tech-grid"
                style={{ minHeight: reservedHeight }}
                className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 transition-[max-height,opacity] duration-300`}
            >
                {data.map(it => (
                    <div style={{ padding: ".35rem .5rem" }} key={it.skill_canonical} className="rounded-lg p-3 bg-slate-800/40 border border-slate-800">
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold text-white text-center">{it && it.skill_canonical && typeof (it.skill_canonical) === "string" && toProperCase(it?.skill_canonical)}</div>
                            <div style={{ padding: ".05rem .25rem" }} className={`text-xs border rounded-sm ${(it.job_count_change_pct ?? 0) > 0 ? 'bg-emerald-700/40 text-emerald-200 border-green-400/30' : 'bg-slate-700/40 text-slate-300'
                                }`}>
                                {Math.round(((it as TopTechnologiesItem).job_count_change_pct ?? 0) * 100)}%
                            </div>
                        </div>
                        <div style={{ margin: "1rem 0 0 0" }} className="text-xs grid grid-cols-3 text-slate-400 mt-1">
                            <div className="text-slate-200 text-center">p50: <span className='font-bold'>${(it.salary_median ?? 0).toLocaleString()}</span></div>
                            <div className="text-slate-200 text-center">p75: <span className='font-bold'>${(it.salary_p75 ?? 0).toLocaleString()}</span></div>
                            <div className="text-slate-200 text-center">p95: <span className='font-bold'>${(it.salary_p95 ?? 0).toLocaleString()}</span></div>
                        </div>
                    </div>
                ))}
                {Array.from({ length: fillerCount }).map((_, idx) => (
                    <div
                        key={`filler-${idx}`}
                        aria-hidden
                        className="rounded-lg p-3 bg-transparent border border-transparent"
                        style={{ visibility: "hidden" }}
                    />
                ))}
            </div>
        </div>
    );
}

function useResponsiveColumns() {
    const getColumns = () => {
        if (typeof window === "undefined") return 1;
        const width = window.innerWidth;
        if (width >= 1280) return 3;
        if (width >= 640) return 2;
        return 1;
    };

    const [columns, setColumns] = React.useState(getColumns);

    React.useEffect(() => {
        const handler = () => setColumns(getColumns());
        window.addEventListener("resize", handler);
        return () => window.removeEventListener("resize", handler);
    }, []);

    return columns;
}
