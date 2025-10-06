import { render, screen } from '@testing-library/react';
import SkillList from '../frontend/src/components/trends/SkillList';
import { type SkillTrend } from '../frontend/src/services/trends';

const S: SkillTrend = {
    id: '1', pk: 'pk', sk: 'sk', skill: 'Node', region: 'US', seniority: 'mid', type: 'runtime',
    count: 10, relativeDemand: 0.1, remotePercentage: 20, avgSalary: null, lastUpdated: undefined,
    associatedRoles: [], cooccurringSkills: {}, topIndustries: []
};

test('renders list of skills', () => {
    render(<SkillList skills={[S]} />);
    expect(screen.getByText('Node')).toBeInTheDocument();
});

test('renders empty state', () => {
    render(<SkillList skills={[]} />);
    expect(screen.getByText(/No skills found|No skills/i)).toBeInTheDocument();
});
