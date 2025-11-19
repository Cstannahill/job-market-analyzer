import React from 'react';
import { describe, it, beforeAll, beforeEach, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { BaseJobListing } from '@/shared-types';
import { JobPostingCard } from '@/components/postings/JobPostingCard';

const mockHasTechIcon = vi.fn<boolean, [string]>();

vi.mock('@/components/postings/MetaPillContainer', () => ({
  MetaPillContainer: ({ date }: { date: string }) => (
    <div data-testid="meta-pill">{date}</div>
  ),
}));

vi.mock('@/components/postings/CompanyBadgeSvgr', () => ({
  default: ({ name }: { name: string }) => <div data-testid="company-badge">{name}</div>,
}));

vi.mock('@/components/postings/TechBadgeSvgr', () => ({
  default: ({ name }: { name: string }) => <div data-testid="tech-badge">{name}</div>,
}));

vi.mock('@/lib/utils/techBadgeHelpers', () => ({
  hasTechIcon: (name: string) => mockHasTechIcon(name),
}));

beforeAll(() => {
  if (!(String.prototype as unknown as Record<string, unknown>).toProperCase) {
    Object.defineProperty(String.prototype, 'toProperCase', {
      value: function toProperCase(this: string) {
        return this.replace(/\w\S*/g, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase());
      },
      configurable: true,
    });
  }
});

beforeEach(() => {
  mockHasTechIcon.mockReset().mockReturnValue(true);
});

const basePosting: BaseJobListing = {
  jobId: 'job-123',
  job_title: 'software engineer',
  job_description: 'A great opportunity to build things.',
  job_board_source: 'internal',
  source_url: 'https://example.com/posting',
  location: 'Remote',
  processed_date: '2025-01-01T00:00:00Z',
  company_name: 'ExampleCo',
  skills: ['typescript', 'communication', 'leadership'],
  technologies: ['react', 'node', 'graphql'],
  salary_range: '$120k',
  industry: 'Tech',
  remote_status: 'remote',
  seniority_level: 'mid',
  requirements: [],
  benefits: [],
  company_size: '100-500',
  salary_currency: 'USD',
  salary_mentioned: true,
  salary_min: 100000,
  salary_max: 130000,
  processed_timestamp: '2025-01-01T00:00:00Z',
  date: '2025-01-01',
  job_description_tokens: [],
  job_title_tokens: [],
  technologies_normalized: [],
  requirements_tokens: [],
};

const renderCard = (overrides: Partial<BaseJobListing> = {}) =>
  render(
    <MemoryRouter>
      <JobPostingCard posting={{ ...basePosting, ...overrides }} />
    </MemoryRouter>,
  );

describe('JobPostingCard', () => {
  it('links to job detail route and shows salary text', () => {
    renderCard();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/postings/job-123');
    expect(screen.getByText('$120k')).toBeInTheDocument();
  });

  it('truncates long descriptions for the preview', () => {
    const longDescription = 'a'.repeat(220);
    renderCard({ job_description: longDescription });
    expect(screen.getByText(longDescription.slice(0, 200) + '...')).toBeInTheDocument();
  });

  it('renders technology badges only when icons exist', () => {
    mockHasTechIcon.mockImplementation((name) => name.startsWith('r'));
    renderCard({ technologies: ['react', 'rust', 'node'] });
    const badges = screen.getAllByTestId('tech-badge');
    expect(badges).toHaveLength(2);
    expect(badges.map((badge) => badge.textContent)).toEqual(['react', 'rust']);
  });

  it('omits salary text when range is Unknown', () => {
    renderCard({ salary_range: 'Unknown' });
    expect(screen.queryByText('Unknown')).not.toBeInTheDocument();
  });
});
