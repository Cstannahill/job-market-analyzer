import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.hoisted(() => {
  vi.stubEnv('VITE_AUTH_API_URL', 'https://auth.example');
});

const storage = new Map<string, string>();

const localStorageMock = {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    storage.set(key, value);
  }),
  removeItem: vi.fn((key: string) => {
    storage.delete(key);
  }),
  clear: vi.fn(() => {
    storage.clear();
  }),
};

const fetchMock = vi.fn();

vi.stubGlobal('localStorage', localStorageMock as unknown as Storage);
vi.stubGlobal('fetch', fetchMock);

const { authService } = await import('@/services/authService');

describe('authService', () => {
  beforeEach(() => {
    storage.clear();
    Object.values(localStorageMock).forEach((fn) => {
      if (typeof fn === 'function' && 'mockClear' in fn) {
        (fn as vi.Mock).mockClear();
      }
    });
    fetchMock.mockReset();
    vi.useRealTimers();
  });

  it('reads cached user profile from localStorage', () => {
    const profile = { userId: 'u1', email: 'demo@example.com' };
    localStorageMock.setItem('auth_user_profile', JSON.stringify(profile));

    expect(authService.getCachedUserProfile()).toEqual(profile);
  });

  it('invalidates expired access tokens', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    (authService as any).storeTokens({
      accessToken: 'token',
      idToken: 'id',
      refreshToken: 'refresh',
      expiresIn: 1,
      tokenType: 'Bearer',
    });

    vi.setSystemTime(new Date('2025-01-01T00:02:00Z'));
    expect(authService.getAccessToken()).toBeNull();
  });

  it('logs out and clears stored tokens', async () => {
    (authService as any).storeTokens({
      accessToken: 'token',
      idToken: 'id',
      refreshToken: 'refresh',
      expiresIn: 3600,
      tokenType: 'Bearer',
    });
    fetchMock.mockResolvedValue({ ok: true });

    await authService.logout();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://auth.example/auth/logout',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer token' }),
      }),
    );
    expect(storage.size).toBe(0);
  });
});
