import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getTop, getTechDetail } from '@/services/trendsv2Service';

vi.hoisted(() => {
  vi.stubEnv('VITE_TRENDSV2_API_URL', 'https://api.example');
});

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const createResponse = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data), { status: 200, ...init });

describe('trendsv2Service', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('fetches top technologies', async () => {
    fetchMock.mockResolvedValueOnce(
      createResponse({
        data: [{ id: 'react', job_count: 5 }],
      }),
    );

    const result = await getTop({ region: 'GLOBAL', period: '2025-W01', limit: 5 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0].toString()).toContain('/v2/trends/technologies/top');
    expect(result).toEqual([{ id: 'react', job_count: 5 }]);
  });

  it('fetches technology detail', async () => {
    fetchMock.mockResolvedValueOnce(
      createResponse({
        name: 'React',
      }),
    );

    const detail = await getTechDetail({ name: 'React', region: 'GLOBAL', period: '2025-W01' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0].toString()).toContain('/v2/trends/technology/React');
    expect(detail).toMatchObject({ name: 'React' });
  });
});
