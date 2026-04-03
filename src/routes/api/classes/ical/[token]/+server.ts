import { classService } from '$lib/server/services/class.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  const ical = await classService.generateIcalFeed(params.token);

  if (!ical) {
    return new Response('Calendar not found', { status: 404 });
  }

  return new Response(ical, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="classes.ics"',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
};
