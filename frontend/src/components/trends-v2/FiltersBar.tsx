// src/features/trends-v2/FiltersBar.tsx
// import { useState } from 'react';
import type { Region, Period } from '@job-market-analyzer/types/trendsv2';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
type Props = {
    region: Region;
    period: Period;
    weeks: string[];
    onChange: (v: { region: Region; period: Period }) => void;
};

export default function FiltersBar({ region, period, weeks, onChange }: Props) {
    // const [p, setP] = useState(period);

    return (

        <Select

            value={period ?? ""}
            onValueChange={(v) => onChange({ region, period: v as Period })}
        >
            <SelectTrigger style={{ padding: "0 .5rem" }} className="w-[180px]" aria-label="Select time period">
                <SelectValue />
            </SelectTrigger>
            <SelectContent >
                <SelectGroup>
                    <SelectLabel style={{ padding: "0 .5rem", margin: ".25rem .5rem" }}>Time Period</SelectLabel>
                    {weeks && weeks.map(wk => <SelectItem style={{ padding: "0 .5rem", margin: ".25rem 0rem" }} value={wk ?? " "}>{wk}</SelectItem>)}
                </SelectGroup>
            </SelectContent>
        </Select>
    );
}
