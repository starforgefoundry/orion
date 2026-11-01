import { PASS_KIND } from '$lib/utils/member-enums';
import { SPACE_ZONE } from '$lib/utils/space';
import { CAR_BAY_TIER, CAR_BAY_TIER_NAMES } from '$lib/utils/car-bay';
import { factory } from '$test/factory';
import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { PASS_TITLES, passDetails } from './pass-details';

const STARTS_AT = DateTime.fromISO('2026-10-16T18:00', { zone: SPACE_ZONE });

function fieldValues(fields: { key: string; value: string }[]) {
  return Object.fromEntries(fields.map(({ key, value }) => [key, value]));
}

describe(passDetails.name, () => {
  it('keeps the member id as the serial of a membership pass', () => {
    const pass = factory.membershipPass();

    expect(passDetails(pass)).toMatchObject({
      kind: PASS_KIND.MEMBERSHIP,
      title: PASS_TITLES[PASS_KIND.MEMBERSHIP],
      serial: pass.member.id,
      holderName: pass.member.name,
    });
  });

  it('serials other passes by kind and token', () => {
    const pass = factory.dayPassTicket();

    expect(passDetails(pass).serial).toBe(`${PASS_KIND.DAY_PASS}-${pass.passToken}`);
  });

  it('shows the purchase day of a day pass at the space', () => {
    const lateEvening = STARTS_AT.set({ hour: 23 }).toUTC();
    const pass = factory.dayPassTicket({
      dayPass: factory.dayPass({ purchasedDate: lateEvening }),
    });

    expect(fieldValues(passDetails(pass).fields).purchased).toBe('Oct 16, 2026');
  });

  it('brings a class pass up from the class start until it ends', () => {
    const booking = factory.classBooking({ customerName: 'Ada', quantity: 2 });
    const pass = factory.classPass({
      booking,
      instance: factory.classInstance({
        date: '2026-10-16',
        startTime: '18:00',
        durationMinutes: 90,
      }),
      catalog: factory.classCatalog({ name: 'Welding' }),
    });

    const details = passDetails(pass);

    expect(details.holderName).toBe('Ada');
    expect(fieldValues(details.fields)).toMatchObject({ class: 'Welding', spots: '2' });
    expect(details.relevantDate?.toISO()).toBe(STARTS_AT.toISO());
    expect(details.expiresAt?.toISO()).toBe(STARTS_AT.plus({ minutes: 90 }).toISO());
  });

  it('names the car bay tier and expires at the end of the booking', () => {
    const booking = factory.carBayBooking({ tier: CAR_BAY_TIER.FULL_DAY });

    const details = passDetails(factory.carBayPass({ booking }));

    expect(fieldValues(details.fields).tier).toBe(CAR_BAY_TIER_NAMES[CAR_BAY_TIER.FULL_DAY]);
    expect(details.relevantDate).toBe(booking.startAt);
    expect(details.expiresAt).toBe(booking.endAt);
  });
});
