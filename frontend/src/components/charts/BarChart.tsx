import React from 'react';
import { BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

type DataPoint = { name: string; value: number };

export const BarChart: React.FC<{ data: DataPoint[] }> = ({ data }) => {
    return (
        <ResponsiveContainer width="100%" height={220}>
            <ReBarChart data={data} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={120} />
                <Tooltip />
                <Bar dataKey="value" fill="#7c3aed" />
            </ReBarChart>
        </ResponsiveContainer>
    );
};
