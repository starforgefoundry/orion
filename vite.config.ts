import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
    env: {
      FRONTEND_URL: 'https://orion.example.com',
      FILE_SIGNING_SECRET: 'test-secret',
      PUBLIC_PRINT_REQUEST_EMAIL: 'prints@example.com',
    },
    expect: { requireAssertions: true },
    mockReset: true,
    restoreMocks: true,
    unstubEnvs: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
  server: {
    allowedHosts: ['.bwees.io'],
  },
});
