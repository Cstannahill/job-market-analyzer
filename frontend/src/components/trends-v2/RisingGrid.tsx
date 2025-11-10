// src/features/trends-v2/RisingGrid.tsx
import type { TopTechnologiesItem } from '@/shared-types/src/trendsv2';
import React from "react";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronDownCircle, ChevronUpCircle } from 'lucide-react';
import { H2 } from '@/components/ui/typography';

export default function RisingGrid({ data }: { data: TopTechnologiesItem[] }) {
    const [isOpen, setIsOpen] = React.useState(true)

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}>
            <div style={{ padding: ".5rem .5rem" }} className="nf-mono text-sm mb-2 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                <H2 text="Rising This Period" style={{ fontSize: "1.45rem" }} className="text-shadow-green text-center col-start-1 md:col-start-2" />
                <div className='flex justify-end col-start-3'>
                    <CollapsibleTrigger asChild>
                        {isOpen ? <ChevronDownCircle className="rounded-md hover:border hover:border-primary-500 hover:bg-stone-300" size={20} fill='#d8d4d9eb' stroke="#941eb8" strokeWidth={2} />
                            :
                            <ChevronUpCircle className="rounded-md hover:border hover:border-primary-500 hover:bg-stone-300" size={20} fill='#d8d4d9eb' stroke="#941eb8" strokeWidth={2} />
                        }
                    </CollapsibleTrigger>
                </div>
            </div>
            <CollapsibleContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {data.map(it => (
                        <div style={{ padding: ".35rem .5rem" }} key={it.skill_canonical} className="rounded-lg p-3 bg-slate-800/40 border border-slate-800">
                            <div className="flex items-center justify-between">
                                <div className="text-sm font-semibold text-white">{it.skill_canonical.toProperCase()}</div>
                                <div className={`text-xs px-2 py-0.5 rounded ${(it.job_count_change_pct ?? 0) > 0 ? 'bg-emerald-700/40 text-emerald-200' : 'bg-slate-700/40 text-slate-300'
                                    }`}>
                                    {Math.round(((it as TopTechnologiesItem).job_count_change_pct ?? 0) * 100)}%
                                </div>
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                                p50: <span className="text-slate-200">${(it.salary_median ?? 0).toLocaleString()}</span> ·
                                p75: <span className="text-slate-200">${(it.salary_p75 ?? 0).toLocaleString()}</span> ·
                                p95: <span className="text-slate-200">${(it.salary_p95 ?? 0).toLocaleString()}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}
