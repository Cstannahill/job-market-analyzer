// src/features/trends-v2/TopList.tsx
import TechCard from './TechCard';
import type { TopTechnologiesItem } from '@job-market-analyzer/types/trendsv2';


export default function TopList({ data, onSelect, selected }: {
    data: TopTechnologiesItem[]; onSelect: (t: TopTechnologiesItem) => void; selected?: TopTechnologiesItem | null;
}) {
    if (!data.length) return <div className="text-sm text-slate-400">No data.</div>;
    return (
        <div style={{ padding: ".5rem .5rem" }} className="flex flex-col divide-y divide-slate-800">
            {data.map(it => (
                <div style={{ padding: ".5rem .5rem" }} key={`${it.skill_canonical}`} className="py-2">
                    <TechCard item={it} onClick={() => onSelect(it)} selected={selected?.skill_canonical === it.skill_canonical} />
                </div>
            ))}
        </div>
    );
}
