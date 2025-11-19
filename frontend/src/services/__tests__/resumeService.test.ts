import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getUserResumes } from '@/services/resumeService';

const axiosMock = vi.hoisted(() => vi.fn());

vi.mock('axios', () => ({
  default: axiosMock,
}));

describe('resumeService', () => {
  beforeEach(() => {
    axiosMock.mockReset();
  });

  it('fetches user resumes with API key header', async () => {
    axiosMock.mockResolvedValueOnce({
      data: { items: [] },
    });

    const result = await getUserResumes('user-123');

    expect(axiosMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: expect.stringContaining('/resumes/user-123'),
        headers: expect.objectContaining({ 'x-api-key': expect.any(String) }),
      }),
    );
    expect(result).toEqual({ items: [] });
  });
});
