import 'fake-indexeddb/auto';
import { vi } from 'vitest';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock);

vi.stubEnv('VITE_API_URL', 'https://api.test/functions/v1/api');
vi.stubEnv('VITE_DEV_TELEGRAM_USER', JSON.stringify({ id: 100001, first_name: 'Dev', username: 'dev_user' }));
