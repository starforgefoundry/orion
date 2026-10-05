// See https://svelte.dev/docs/kit/types#app.d.ts

import type { User } from '$lib/server/db/schema';

// for information about these interfaces
declare global {
  namespace App {
    interface PageData {
      user?: User;
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
