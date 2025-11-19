import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.hoisted(() => {
  vi.stubEnv('VITE_API_URL', 'https://api.example');
});

const axiosModule = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    get: axiosModule.get,
  },
}));

let normalizeRow: (row: Record<string, unknown>) => any;
let fetchTop: (params?: { region?: string; seniority?: string; limit?: number }) => Promise<any[]>;

beforeEach(async () => {
  const mod = await import('@/services/trendsService');
  normalizeRow = mod.normalizeRow;
  fetchTop = mod.fetchTop;
  axiosModule.get.mockReset();
});

describe('trendsService', () => {
  it('normalizes trend rows', () => {
    const row = {
      PK: 'skill#tsx',
      SK: 'region#global#seniority#mid',
      skill: 'tsx',
      region: 'global',
      seniority: 'mid',
      count: '5',
      remote_percentage: '0.5',
      avg_salary: '120000',
      cooccurring_skills: { react: { N: '4' } },
      top_industries: [{ S: 'Finance' }],
    };

    const result = normalizeRow(row);
    expect(result.skill).toBe('tsx');
    expect(result.region).toBe('global');
    expect(result.count).toBe(5);
    expect(result.remotePercentage).toBe(50);
    expect(result.cooccurringSkills.react).toBe(4);
    expect(result.topIndustries).toEqual(['Finance']);
  });

  it('fetches top trends via axios', async () => {
    axiosModule.get.mockResolvedValueOnce({
      data: {
        data: [{ PK: 'skill#python', SK: 'region#global', count: 1 }],
      },
    });

    const rows = await fetchTop({ region: 'global', limit: 5 });

    expect(axiosModule.get).toHaveBeenCalledWith(
      expect.stringContaining('/trends/region?'),
    );
    expect(rows[0].skill).toContain('python');
  });
});
