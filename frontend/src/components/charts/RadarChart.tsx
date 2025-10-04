import React from 'react';
import { Radar, RadarChart as ReRadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

type DataPoint = { subject: string; A: number };

export const RadarChart: React.FC<{ data: DataPoint[] }> = ({ data }) => {
    return (
        <ResponsiveContainer width="100%" height={260}>
            <ReRadarChart data={data} cx="50%" cy="50%" outerRadius="80%">
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" />
                <PolarRadiusAxis angle={30} domain={[0, 'dataMax']} />
                <Radar name="Score" dataKey="A" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.6} />
            </ReRadarChart>
        </ResponsiveContainer>
    );
};
