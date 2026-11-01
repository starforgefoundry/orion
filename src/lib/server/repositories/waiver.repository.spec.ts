import { SPACE_ZONE } from '$lib/space';
import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { signatureKey } from './waiver.repository';

describe(signatureKey.name, () => {
  it('dates the signature by the day at the space, not in UTC', () => {
    const eveningAtTheSpace = DateTime.fromISO('2026-10-16T19:30', { zone: SPACE_ZONE });

    expect(signatureKey('Ada Lovelace', 'waiver-1', eveningAtTheSpace)).toBe(
      'waivers/Ada_Lovelace_2026-10-16_waiver-1',
    );
  });
});
