import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getJobPostingsStats } from '@/services/jobStatsService';

const axiosModule = vi.hoisted(() => ({
  axiosGet: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    get: axiosModule.axiosGet,
  },
  isAxiosError: () => false,
}));

describe('getJobPostingsStats', () => {
  beforeEach(() => {
    axiosModule.axiosGet.mockReset();
  });

  it('normalizes stats payloads with skill/tech counts', async () => {
    axiosModule.axiosGet.mockResolvedValueOnce({
      data: {
        stats: {
          totalPostings: 5,
          technologyCounts: {
            react: 3,
            node: 2,
          },
          skillCounts: {
            python: 4,
          },
        },
      },
    });

    const result = await getJobPostingsStats();
    expect(result.totalPostings).toBe(5);
    expect(result.technologies).toEqual([
      { id: 'react', name: 'react', count: 3 },
      { id: 'node', name: 'node', count: 2 },
    ]);
    expect(result.skills).toEqual([{ id: 'python', name: 'python', count: 4 }]);
  });

  it('handles Lambda proxy body string', async () => {
    axiosModule.axiosGet.mockResolvedValueOnce({
      data: {
        stats: {
          statusCode: 200,
          body: JSON.stringify({
            technologyCounts: {
              angular: 1,
            },
            skillCounts: {
              java: 2,
            },
            totalTechnologies: 1,
            totalSkills: 1,
            totalPostings: 10,
          }),
        },
      },
    });

    const result = await getJobPostingsStats();
    expect(result.totalTechnologies).toBe(1);
    expect(result.totalSkills).toBe(1);
    expect(result.technologies?.[0]).toMatchObject({ id: 'angular', count: 1 });
  });
});
