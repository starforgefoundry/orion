// See https://svelte.dev/docs/kit/types#app.d.ts

import type { User } from '$lib/db/schema';

// for information about these interfaces
declare global {
  namespace App {
    interface Platform {
      env: Env;
      cf: CfProperties;
      ctx: ExecutionContext;
    }
    interface Locals {
      user?: User;
    }
  }
}

declare module '@auth/sveltekit' {
  interface Session {
    user?: User;
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    user?: User;
  }
}

export {};
