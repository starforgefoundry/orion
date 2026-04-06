import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://svelte.dev/docs/kit/integrations
  // for more information about preprocessors
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      routes: {
        include: ['/*'],
        exclude: ['<all>'],
      },
    }),
    experimental: {
      remoteFunctions: true,
    },
  },
  compilerOptions: {
    experimental: {
      async: true,
    },
    // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
    runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true),
  },
};

export default config;
