import { render, screen, fireEvent } from '@testing-library/react';
import SkillCard from './SkillCard';
import { SkillTrend } from '../../services/trends';

const SAMPLE: SkillTrend = {
    id: 'pk|sk',
    pk: 'pk',
    sk: 'sk',
    skill: 'React',
    region: 'US',
    seniority: 'mid',
    type: 'framework',
    count: 42,
    relativeDemand: 0.5,
    remotePercentage: 60,
    avgSalary: 120000,
    lastUpdated: '2025-10-05',
    associatedRoles: ['Frontend Engineer'],
    cooccurringSkills: { 'TypeScript': 30 },
    topIndustries: ['Software']
};

test('renders skill card and responds to click', () => {
    const onClick = vi.fn();
    render(<SkillCard skill={SAMPLE} onClick={onClick} />);
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('Demand')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
});
