import { type SkillTrend } from '../../services/trends';
import SkillCard from './SkillCard';

type Props = {
    skills: SkillTrend[];
    onSelect?: (skill: SkillTrend) => void;
};

export default function SkillList({ skills, onSelect }: Props) {
    if (!skills || skills.length === 0) {
        return <div className="text-sm text-slate-400">No skills found.</div>;
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {skills.map((s) => (
                <SkillCard key={s.id} skill={s} onClick={() => onSelect && onSelect(s)} />
            ))}
        </div>
    );
}
