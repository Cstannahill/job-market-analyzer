import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getJobPostingsPage } from '@/services/jobPostingsService';

const axiosModule = vi.hoisted(() => ({
  axiosGet: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    get: axiosModule.axiosGet,
  },
}));

describe('getJobPostingsPage', () => {
  beforeEach(() => {
    axiosModule.axiosGet.mockReset();
  });

  it('requests job postings with serialization of filters', async () => {
    axiosModule.axiosGet.mockResolvedValueOnce({
      data: {
        items: [
          {
            Id: '1',
            title: 'Engineer',
            job_description: 'Build',
            location: 'Remote',
            skills: [],
            technologies: [],
            date: '2025-01-01',
            company_name: 'Example',
            industry: 'Tech',
            remote_status: 'remote',
            seniority_level: 'mid',
            salary_range: '$100k',
            requirements: [],
            source_url: 'https://example.com',
            job_board_source: 'internal',
          },
        ],
        lastKey: 'next',
        count: 1,
      },
    });

    const result = await getJobPostingsPage({
      limit: 10,
      lastKey: 'abc',
      tech: 'react',
      workModes: ['remote'],
      seniorityLevels: ['senior'],
    });

    expect(axiosModule.axiosGet).toHaveBeenCalledWith(
      expect.stringContaining('job-postings?limit=10&lastKey=abc&tech=react&remote_status=remote&seniority_level=senior'),
    );
    expect(result.items[0]).toMatchObject({
      jobId: '1',
      job_title: 'Engineer',
      remote_status: 'remote',
    });
    expect(result.lastKey).toBe('next');
    expect(result.count).toBe(1);
  });

  it('handles Lambda proxy responses', async () => {
    axiosModule.axiosGet.mockResolvedValueOnce({
      data: {
        statusCode: 200,
        body: JSON.stringify({
          data: [
            {
              id: '2',
              job_title: 'Analyst',
              job_description: '',
              location: 'NY',
              skills: [],
              technologies: [],
              processed_date: '2025-01-01',
              company_name: 'Co',
              industry: 'Biz',
              remote_status: 'hybrid',
              seniority_level: 'junior',
              salary_range: '',
              requirements: [],
              source_url: '',
              job_board_source: '',
            },
          ],
          lastKey: null,
          count: 1,
        }),
      },
    });

    const result = await getJobPostingsPage();
    expect(result.items[0].job_title).toBe('Analyst');
    expect(result.lastKey).toBeNull();
  });
});
