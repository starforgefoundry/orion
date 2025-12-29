import type { InferSelectModel } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const user = sqliteTable('user', {
  email: text('email').notNull().unique().primaryKey(),
  name: text('name').notNull(),
  picture: text('picture').notNull(),
});

export type User = InferSelectModel<typeof user>;
