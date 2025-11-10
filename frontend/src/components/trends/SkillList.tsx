// SkillList.tsx
import { type SkillTrend } from '@/shared-types';
import SkillCard from './SkillCardAlt';

type Props = {
    skills: SkillTrend[];
    onSelect?: (skill: SkillTrend) => void;
    isSelected?: SkillTrend | null;
};

export default function SkillList({ skills, onSelect, isSelected }: Props) {
    if (!skills || skills.length === 0) {
        return <div className="text-sm text-slate-400">No skills found.</div>;
    }

    // single-column vertical list — scroll handled by parent card
    return (
        <div className="flex flex-col divide-y divide-slate-800">
            {skills.map((s) => (
                <div key={s.id} className="py-3 my-1">
                    <SkillCard skill={s} onClick={() => onSelect && onSelect(s)} isSelected={isSelected} />
                </div>
            ))}
        </div>
    );
}
