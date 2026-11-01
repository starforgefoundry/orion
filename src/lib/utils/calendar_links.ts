import { SPACE_DOMAIN, SPACE_NAME, SPACE_ZONE } from '$lib/space';
import { DateTime } from 'luxon';

const GOOGLE_CALENDAR_URL = 'https://calendar.google.com/calendar/render';
const ICS_DATA_URL_PREFIX = 'data:text/calendar;charset=utf-8,';
const ICS_PRODUCT_ID = '-//Starforge//Class Booking//EN';
const ICS_LINE_BREAK = '\r\n';
const UTC_STAMP_FORMAT = "yyyyMMdd'T'HHmmss'Z'";
const LOCAL_STAMP_FORMAT = "yyyyMMdd'T'HHmmss";

export type CalendarEvent = {
  /** Stable across downloads so calendars update the event instead of duplicating it. */
  uid: string;
  title: string;
  /** Lines of the event description. */
  details: string[];
  startsAt: DateTime;
  endsAt: DateTime;
};

function utcStamp(date: DateTime) {
  return date.toUTC().toFormat(UTC_STAMP_FORMAT);
}

function spaceStamp(date: DateTime) {
  return date.setZone(SPACE_ZONE).toFormat(LOCAL_STAMP_FORMAT);
}

function googleCalendarUrl(event: CalendarEvent) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${utcStamp(event.startsAt)}/${utcStamp(event.endsAt)}`,
    details: event.details.join('\n'),
    location: SPACE_NAME,
  });
  return `${GOOGLE_CALENDAR_URL}?${params}`;
}

function icsDataUrl(event: CalendarEvent, now: DateTime) {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${ICS_PRODUCT_ID}`,
    'BEGIN:VEVENT',
    `DTSTART;TZID=${SPACE_ZONE}:${spaceStamp(event.startsAt)}`,
    `DTEND;TZID=${SPACE_ZONE}:${spaceStamp(event.endsAt)}`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${event.details.join('\\n')}`,
    `UID:${event.uid}@${SPACE_DOMAIN}`,
    `DTSTAMP:${utcStamp(now)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join(ICS_LINE_BREAK);

  return ICS_DATA_URL_PREFIX + encodeURIComponent(ics);
}

/** "Add to calendar" links for an event at the space. */
export function calendarLinks(event: CalendarEvent, now: DateTime = DateTime.now()) {
  return { google: googleCalendarUrl(event), ics: icsDataUrl(event, now) };
}
