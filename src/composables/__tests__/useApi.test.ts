import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('useApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.stubEnv('VITE_API_URL', 'https://api.test/functions/v1/api');
    vi.stubEnv('VITE_DEV_TELEGRAM_USER', JSON.stringify({ id: 1, first_name: 'Dev' }));
    vi.stubGlobal('window', { Telegram: undefined });
  });

  it('sends query, body and dev auth header', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ ok: true }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { useApi } = await import('../useApi');
    const api = useApi();
    const result = await api.request('/coupons', { method: 'POST', query: { archived: false, empty: '' }, body: { title: 'SALE' } });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [[url, init]] = fetchMock.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit]>;
    const headers = init.headers as Record<string, string>;

    expect(String(url)).toBe('https://api.test/functions/v1/api/coupons?archived=false');
    expect(init.method).toBe('POST');
    expect(headers['X-Dev-Telegram-User']).toContain('Dev');
    expect(init.body).toBe(JSON.stringify({ title: 'SALE' }));
  });

  it('throws friendly API errors', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: false,
      status: 403,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ message: 'Нет доступа', details: { reason: 'forbidden' } }),
    })));

    const { ApiError, useApi } = await import('../useApi');
    const api = useApi();

    await expect(api.request('/private')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Нет доступа',
      status: 403,
      details: { reason: 'forbidden' },
    } satisfies Partial<InstanceType<typeof ApiError>>);
  });

  it('requires VITE_API_URL', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_API_URL', '');
    vi.stubEnv('VITE_DEV_TELEGRAM_USER', '');
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('fetch should not be called without VITE_API_URL'))));

    const { useApi } = await import('../useApi');

    await expect(useApi().request('/health')).rejects.toThrow('Не задан VITE_API_URL');
    expect(fetch).not.toHaveBeenCalled();
  });
});
