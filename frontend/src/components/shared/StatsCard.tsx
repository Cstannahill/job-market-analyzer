import { AnimatedCounter } from "@/components/AnimatedCounter";
import { type FC, type SVGProps } from "react";


export interface StatsCardProps {
    icon: FC<SVGProps<SVGSVGElement>>;
    label: string;
    value: number;
    duration?: number;
    changeText?: string;
    changeType?: 'positive' | 'negative' | 'neutral';
}
const StatsCard = ({ icon: Icon, label, value, duration = 2000, changeText, changeType }: StatsCardProps) => {

    return (<div className="stat-card glass card-hover card-stylish">
        <div className="stat-card-header ">
            <Icon className="text-zinc-800 h-8 w-8" />
            <span className="stat-label text-center">{label}</span>
        </div>
        <div className="stat-value">
            <AnimatedCounter end={value} duration={duration} />
        </div>
        <div className={`stat-change ${changeType}`}>{changeText}</div>
    </div>);
};

export default StatsCard;