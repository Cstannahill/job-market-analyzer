import React from 'react';
import { render, screen } from '@testing-library/react';
import SkillDetailPanel from './SkillDetailPanel';
import { type SkillTrend } from '../../services/trends';

const SAMPLE: SkillTrend = {
    id: 'pk|sk', pk: 'pk', sk: 'sk', skill: 'React', region: 'US', seniority: 'mid', type: 'framework',
    count: 42, relativeDemand: 0.5, remotePercentage: 60, avgSalary: 120000, lastUpdated: '2025-10-01',
    associatedRoles: ['Frontend Engineer'], cooccurringSkills: { 'TypeScript': 30, 'HTML': 15 }, topIndustries: ['Software', 'SaaS']
};

const HISTORY: SkillTrend[] = [
    { ...SAMPLE, lastUpdated: '2025-08-01', count: 30 },
    { ...SAMPLE, lastUpdated: '2025-09-01', count: 35 },
    { ...SAMPLE, lastUpdated: '2025-10-01', count: 42 }
];

test('renders detail panel with salary, industries and sparkline', () => {
    render(<SkillDetailPanel skill={SAMPLE} history={HISTORY} />);
    // Salary should be visible
    expect(screen.getByText(/\$120,000|120000/)).toBeInTheDocument();
    // Top industries should include 'Software'
    expect(screen.getByText('Software')).toBeInTheDocument();
    // Co-occurring header
    expect(screen.getByText(/Top co-occurring skills/i)).toBeInTheDocument();
    // Trend header present
    expect(screen.getByText(/Trend \(counts\)/i)).toBeInTheDocument();
});
