/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    fileParallelism: false,
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/services/**/*.ts',
        'src/utils/**/*.ts',
        'src/composables/useApi.ts',
        'src/composables/useTelegram.ts',
        'src/stores/app.store.ts',
      ],
      exclude: ['src/**/*.d.ts', 'src/**/__tests__/**'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 75,
        statements: 90,
      },
    },
  },
});
