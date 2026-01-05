import { getRequestEvent } from '$app/server';
import { drizzle } from 'drizzle-orm/d1';

export function getDB() {
  const event = getRequestEvent();
  return drizzle(event.platform!.env.DB);
}
