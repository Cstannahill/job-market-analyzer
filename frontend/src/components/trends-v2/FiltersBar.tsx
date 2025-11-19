// src/features/trends-v2/FiltersBar.tsx
import { useState } from 'react';
import type { Region, Period } from '@job-market-analyzer/types/trendsv2';

type Props = {
    region: Region; period: Period;
    onChange: (v: { region: Region; period: Period }) => void;
};

export default function FiltersBar({ region, period, onChange }: Props) {
    const [p, setP] = useState(period);

    return (
        <div className="flex flex-col sm:flex-row gap-3 items-center sm:items-end" >
            <div>
                <label className="block text-xs text-slate-400 mb-1">Period</label>
                <input
                    className="bg-slate-800/60 border border-slate-700 rounded-md px-3 py-2 text-slate-100"
                    value={p} onChange={(e) => setP(e.target.value as Period)} placeholder="2025-W44 or 2025-11-08"
                />
            </div>
            <button
                className="btn rounded-md bg-indigo-600 text-white hover:bg-indigo-500 "
                onClick={() => onChange({ region, period: p })}
            >
                Apply
            </button>
        </div>
    );
}
