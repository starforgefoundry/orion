import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

const CLIENT_SPECS = 'src/**/*.svelte.{test,spec}.{js,ts}';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'server',
          include: ['src/**/*.{test,spec}.{js,ts}'],
          exclude: [CLIENT_SPECS],
        },
      },
      {
        extends: true,
        // Svelte's browser build so runes in .svelte.ts managers react; no DOM is needed.
        resolve: { conditions: ['browser'] },
        test: { name: 'client', include: [CLIENT_SPECS] },
      },
    ],
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
