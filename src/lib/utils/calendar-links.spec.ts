import { SPACE_ZONE } from '$lib/utils/space';
import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { calendarLinks, type CalendarEvent } from './calendar-links';

const STARTS_AT = DateTime.fromISO('2026-10-14T18:30', { zone: SPACE_ZONE });

const EVENT: CalendarEvent = {
  uid: 'booking-123',
  title: 'Intro to Welding',
  details: ['Class: Intro to Welding', 'Booked by: Ada'],
  startsAt: STARTS_AT,
  endsAt: STARTS_AT.plus({ hours: 2 }),
};

const NOW = DateTime.fromISO('2026-10-01T12:00:00Z');

function icsLines(url: string) {
  const [, encoded] = url.split(',');
  return decodeURIComponent(encoded).split('\r\n');
}

describe(calendarLinks.name, () => {
  it('links to a Google Calendar template in UTC', () => {
    const url = new URL(calendarLinks(EVENT, NOW).google);

    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('text')).toBe('Intro to Welding');
    expect(url.searchParams.get('dates')).toBe('20261014T233000Z/20261015T013000Z');
    expect(url.searchParams.get('details')).toBe('Class: Intro to Welding\nBooked by: Ada');
    expect(url.searchParams.get('location')).toBe('Starforge Foundry');
  });

  it('builds an ICS file in the space time zone', () => {
    const { ics } = calendarLinks(EVENT, NOW);

    expect(ics.startsWith('data:text/calendar;charset=utf-8,')).toBe(true);
    expect(icsLines(ics)).toEqual([
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Starforge//Class Booking//EN',
      'BEGIN:VEVENT',
      'DTSTART;TZID=America/Chicago:20261014T183000',
      'DTEND;TZID=America/Chicago:20261014T203000',
      'SUMMARY:Intro to Welding',
      'DESCRIPTION:Class: Intro to Welding\\nBooked by: Ada',
      'UID:booking-123@starforgefoundry.com',
      'DTSTAMP:20261001T120000Z',
      'END:VEVENT',
      'END:VCALENDAR',
    ]);
  });
});
