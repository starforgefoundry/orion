import { env } from '$env/dynamic/private';
import * as schema from '$lib/server/db/schema';
import { SvelteKitAuth } from '@auth/sveltekit';
import Google from '@auth/sveltekit/providers/google';
import { eq } from 'drizzle-orm';
import { getDB } from '../server/db';

export const { handle, signIn, signOut } = SvelteKitAuth({
  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      authorization: {
        url: `https://accounts.google.com/o/oauth2/auth/authorize?response_type=code&prompt=login`,
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  secret: env.AUTH_SECRET,
  trustHost: true,
  callbacks: {
    async signIn({ profile }) {
      if (!profile) return false;

      const email = profile.email;
      if (!email) return false;
      if (!email.endsWith('@starforgefoundry.com')) return false;

      const db = getDB();
      await db
        .insert(schema.user)
        .values({
          email: email,
          name: profile.name ?? '',
          picture: profile.picture ?? '',
        })
        .onConflictDoUpdate({
          target: schema.user.email,
          set: {
            name: profile.name ?? '',
            picture: profile.picture ?? '',
          },
        });

      return true;
    },
    async jwt({ token, trigger }) {
      // Add employee data to the token on sign in or update
      if (trigger === 'signIn' || trigger === 'update') {
        const db = getDB();
        const employeeRecord = await db
          .select()
          .from(schema.user)
          .where(eq(schema.user.email, token.email!))
          .limit(1);

        if (employeeRecord[0]) {
          token.employee = employeeRecord[0];
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Add employee data to the session
      if (token.user) {
        session.user = token.user as typeof session.user;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/login',
    signOut: '/auth/logout',
    error: '/auth/unauthorized',
  },
});
