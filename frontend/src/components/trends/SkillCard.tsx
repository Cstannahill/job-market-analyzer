import { type SkillTrend } from '../../services/trends';

type Props = {
    skill: SkillTrend;
    onClick?: () => void;
};

export default function SkillCard({ skill, onClick }: Props) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-labelledby={`skill-${skill.id}`}
            className={"w-full text-left rounded-lg border border-gray-200 bg-white p-4 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 break-words"}
        >
            <div className="flex justify-between items-start gap-3">
                <div className="min-w-0 flex-1">
                    <h4 id={`skill-${skill.id}`} className="text-base sm:text-lg font-semibold leading-snug whitespace-normal break-words text-white">
                        {skill.skill}
                    </h4>
                    <div className="text-xs sm:text-sm text-gray-500 whitespace-normal break-words">
                        {skill.region || 'global'} · {skill.seniority || 'all'}
                    </div>
                </div>
                <div className="text-right shrink-0">
                    <div className="text-xs sm:text-sm text-gray-600">Demand</div>
                    <div className="font-mono text-sm sm:text-base text-white">{skill.count}</div>
                </div>
            </div>
            <div className="mt-2 text-xs sm:text-sm text-gray-600">Remote: {skill.remotePercentage}%</div>
        </button>
    );
}
