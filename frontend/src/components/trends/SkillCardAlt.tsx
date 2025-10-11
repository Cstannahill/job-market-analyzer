// SkillCard.tsx
import { toProperCase } from '@/lib/stringHelpers';
import type { SkillTrend } from '../../services/trends';

export interface SkillCardProps {
    skill: SkillTrend;
    onClick?: () => void;
    isSelected?: SkillTrend | null;
};

function parseTagString(value?: unknown) {
    if (!value) return [];
    const arr = Array.isArray(value) ? value : [value];
    const tokens: string[] = arr.flatMap((v) => {
        const s = String(v)
            .replace(/#/g, ',')
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);
        return s;
    });

    const filtered = tokens
        .map((t) => t.trim())
        .filter((t) => {
            const lower = t.toLowerCase();
            if (!t) return false;
            if (['skill', 'region', 'seniority', 'pk', 'sk', 'type'].includes(lower)) return false;
            if (/^skill[:#]/i.test(t)) return false;
            return true;
        });

    return Array.from(new Set(filtered)).slice(0, 6);
}


export default function SkillCard({ skill, onClick, isSelected }: SkillCardProps) {
    const industries = parseTagString(skill.topIndustries);
    const regionLabel = skill.region || 'global';
    const seniorityLabel = skill.seniority || 'all';

    // Title cleaning + proper-case rules (keep short names uppercase)
    const raw = String(skill.skill ?? '');
    let title = raw.includes('#') ? raw.split('#').pop() || raw : raw;
    if (title.length > 3) title = toProperCase(title);
    else title = title.toUpperCase();
    const handleClick = () => {
        console.log(isSelected?.id)
        console.log(`Skill ID: ${skill.id}`)
        if (onClick) onClick();
    }
    return (
        <button
            id={`skill-${skill.id}`}
            type="button"
            onClick={handleClick}
            aria-labelledby={`skill-${skill.id}`}
            className="relative w-full text-left rounded-xl transition transform hover:scale-[1.01] focus:scale-[1.01] bg-slate-900/60 hover:bg-slate-900/70 ring-0 focus:outline-none focus-visible:ring-4 focus-visible:ring-purple-600/30 p-3 flex items-start gap-4"
        >
            <div className="flex-none w-12 h-12 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-500 flex items-center justify-center shadow">
                <span className="text-white font-extrabold uppercase select-none">{(skill.skill || '').slice(0, 2)}</span>
            </div>

            <div className="min-w-0 flex-1">
                <h4
                    id={`skill-${skill.id}`}
                    className="text-base sm:text-lg font-semibold text-white leading-snug"
                    style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        wordBreak: 'normal',
                        overflowWrap: 'anywhere',
                    }}
                    title={title}
                >
                    {title}
                </h4>

                <div className="mt-2 text-xs text-slate-400 flex flex-wrap items-center gap-2">
                    <span className="text-slate-500">Region</span>
                    <span className="text-slate-300">{regionLabel}</span>
                    <span className="text-slate-500">·</span>
                    <span className="text-slate-500">Seniority</span>
                    <span className="text-slate-300">{seniorityLabel}</span>
                </div>

                {industries.length > 0 && (
                    <div className="mt-3 flex gap-2 flex-wrap">
                        {industries.slice(0, 3).map((t) => (
                            <span
                                key={t}
                                className="inline-block text-[11px] text-slate-100 bg-white/5 px-2 py-0.5 rounded-md truncate"
                                title={t}
                            >
                                {t}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex-none text-right pl-4">
                <div className="text-[11px] text-slate-400">Demand</div>
                <div className="mt-1 text-lg sm:text-xl font-mono font-semibold bg-clip-text text-transparent bg-gradient-to-r from-purple-300 to-indigo-300">
                    {Number(skill.count ?? 0)}
                </div>
                <div className="mt-1 text-[12px] text-slate-400">Remote: <span className="text-slate-300">{skill.remotePercentage ?? 0}%</span></div>
            </div>
        </button>
    );
}
