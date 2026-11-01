import { schema } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { eq } from 'drizzle-orm';

/** Staff accounts that sign in to Orion. */
export class UserRepository extends BaseRepository {
  async getAll() {
    return await this.db.select().from(schema.user);
  }

  async getByEmail(email: string) {
    const [user] = await this.db.select().from(schema.user).where(eq(schema.user.email, email));
    return user;
  }

  async setGoogleCalendarId(email: string, calendarId: string) {
    await this.db
      .update(schema.user)
      .set({ googleCalendarId: calendarId })
      .where(eq(schema.user.email, email));
  }
}
