import type { SkillTrend } from '../../services/trends';

type Props = {
    skill: SkillTrend;
    onClick?: () => void;
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

function toProperCase(str: string) {
    return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

export default function SkillCard({ skill, onClick }: Props) {
    const industries = parseTagString(skill.topIndustries);
    const regionLabel = skill.region || 'global';
    const seniorityLabel = skill.seniority || 'all';

    // Title cleaning + proper-case rules (keep short names uppercase)
    const raw = String(skill.skill ?? '');
    let title = raw.includes('#') ? raw.split('#').pop() || raw : raw;
    if (title.length > 3) title = toProperCase(title);
    else title = title.toUpperCase();

    return (
        <button
            type="button"
            onClick={onClick}
            aria-labelledby={`skill-${skill.id}`}
            className="relative outline w-full text-left rounded-xl p-[1px] bg-gradient-to-r from-transparent via-purple-700/12 to-transparent hover:via-purple-600/20 transition
                 focus:outline-none focus-visible:ring-4 focus-visible:ring-purple-600/20"
        >
            <div className="bg-slate-900/70 backdrop-blur-sm rounded-lg px-4 py-4 min-h-full">
                {/* HEADER: title + demand (single row) */}
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
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

                        <div className="mt-2 text-xs text-slate-400">
                            <div className="flex flex-wrap items-center gap-2 text-[12px]">
                                <span className="text-slate-500">Region</span>
                                <span className="text-slate-300">{regionLabel}</span>
                                <span className="text-slate-500">·</span>
                                <span className="text-slate-500">Seniority</span>
                                <span className="text-slate-300">{seniorityLabel}</span>
                            </div>

                            <div className="mt-1 text-[12px] text-slate-400">
                                Remote: <span className="text-slate-300">{skill.remotePercentage ?? 0}%</span>
                            </div>
                        </div>
                    </div>

                    {/* Demand lives here in the header row (shrink-0 keeps it compact) */}
                    <div className="shrink-0 text-right flex flex-col items-end">
                        <div className="text-[11px] text-slate-400">Demand</div>
                        <div className="mt-1 text-lg sm:text-xl font-mono font-semibold text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-indigo-300">
                            {Number(skill.count ?? 0)}
                        </div>
                    </div>
                </div>

                {/* TAGS / INDUSTRIES / EXTRA META */}
                {industries.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {industries.slice(0, 4).map((t) => (
                            <span
                                key={t}
                                className="inline-block text-[11px] text-slate-100 bg-white/5 px-2 py-0.5 rounded-md max-w-[10rem] truncate"
                                title={t}
                            >
                                {t}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </button>
    );
}
