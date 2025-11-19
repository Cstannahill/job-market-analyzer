import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getNeonJobPostingsPage } from '@/services/jobPostingsNeonService';

const axiosModule = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    get: axiosModule.get,
  },
  isAxiosError: () => false,
}));

vi.stubEnv('VITE_API_URL', 'https://api.example');

describe('getNeonJobPostingsPage', () => {
  beforeEach(() => {
    axiosModule.get.mockReset();
  });

  it('serializes query params and maps records', async () => {
    axiosModule.get.mockResolvedValueOnce({
      data: {
        success: true,
        total: 1,
        totalPages: 1,
        page: 2,
        pageSize: 5,
        items: [
          {
            id: 'abc',
            dynamo_id: 'dyn-1',
            job_title: 'Engineer',
            company_name: 'Acme',
            remote_status: 'Remote',
            technologies: ['react', 'node'],
            minimum_salary: 100000,
            maximum_salary: 120000,
          },
        ],
      },
    });

    const result = await getNeonJobPostingsPage({
      page: 2,
      pageSize: 5,
      tech: 'react',
      remoteStatuses: ['remote'],
      seniorityLevels: ['senior'],
    });

    expect(axiosModule.get).toHaveBeenCalledWith(
      expect.stringContaining(
        '/job-postings-neon?page=2&pageSize=5&status=Active&tech=react&remote_status=remote&seniority_level=senior',
      ),
    );
    expect(result.items[0]).toMatchObject({
      jobId: 'dyn-1',
      company_name: 'Acme',
      remote_status: 'remote',
      technologies: ['react', 'node'],
      salary_range: '100000-120000',
    });
    expect(result.page).toBe(2);
  });

  it('throws when success flag is false', async () => {
    axiosModule.get.mockResolvedValueOnce({
      data: { success: false },
    });

    await expect(getNeonJobPostingsPage()).rejects.toThrow(
      /Neon job postings endpoint returned an error/,
    );
  });
});
