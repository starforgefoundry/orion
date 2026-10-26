import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
    environment: 'node',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    env: {
      FRONTEND_URL: 'https://orion.example.com',
      FILE_SIGNING_SECRET: 'test-secret',
      PUBLIC_PRINT_REQUEST_EMAIL: 'prints@example.com',
    },
    mockReset: true,
    restoreMocks: true,
    unstubEnvs: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
