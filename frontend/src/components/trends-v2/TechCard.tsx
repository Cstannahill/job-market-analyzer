// src/features/trends-v2/TechCard.tsx
import type { TopTechnologiesItem } from '@/shared-types/src/trendsv2';

export default function TechCard({ item, onClick, selected }: {
    item: TopTechnologiesItem; onClick?: () => void; selected?: boolean;
}) {
    const title = item.skill_canonical.length > 3 ? toTitle(item.skill_canonical) : item.skill_canonical.toUpperCase();
    return (
        <button onClick={onClick} className={`w-full text-left rounded-xl p-2 transition
      ${selected ? 'ring-2 ring-purple-500/40 bg-slate-900/70' : 'bg-slate-900/60 hover:bg-slate-900/70'}
    `}>
            <div style={{ padding: ".5rem .5rem" }} className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-sm font-semibold text-white">{title}</div>
                    <div className="text-xs text-slate-400 mt-1">
                        Remote: <span className="text-slate-200">{Math.round((item as TopTechnologiesItem).remote_share ?? 0 * 100) / 100}%</span>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-[11px] text-slate-400">Demand</div>
                    <div className="text-lg font-mono text-white">{item.job_count}</div>
                </div>
            </div>
        </button>
    );
}
function toTitle(s: string) { return s.replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase()); }
