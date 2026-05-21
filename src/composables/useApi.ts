import { useTelegram } from './useTelegram';

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
};

const API_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '';

function buildUrl(path: string, query?: RequestOptions['query']) {
  const url = new URL(`${API_URL}${path.startsWith('/') ? path : `/${path}`}`);

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

export function useApi() {
  const { initData } = useTelegram();

  const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
    if (!API_URL) {
      throw new ApiError('Не задан VITE_API_URL в .env', 500);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (initData.value) {
      headers['X-Telegram-Init-Data'] = initData.value;
    }

    if (!initData.value && import.meta.env.VITE_DEV_TELEGRAM_USER) {
      headers['X-Dev-Telegram-User'] = import.meta.env.VITE_DEV_TELEGRAM_USER;
    }

    const response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const isJson = response.headers.get('content-type')?.includes('application/json');
    const payload = isJson ? await response.json() : null;

    if (!response.ok) {
      throw new ApiError(payload?.message || 'Ошибка запроса', response.status, payload?.details);
    }

    return payload as T;
  };

  return { request };
}
