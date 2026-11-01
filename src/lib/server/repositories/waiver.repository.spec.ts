import { fileUrl } from '$lib/server/utils/storage';
import { SPACE_ZONE } from '$lib/utils/space';
import { describeWithDatabase, useTestDatabase } from '$test/db';
import { DateTime } from 'luxon';
import { beforeEach, describe, expect, it } from 'vitest';
import { signatureKey, WaiverRepository } from './waiver.repository';

const PAGE_SIZE = 25;

describe(signatureKey.name, () => {
  it('dates the signature by the day at the space, not in UTC', () => {
    const eveningAtTheSpace = DateTime.fromISO('2026-10-16T19:30', { zone: SPACE_ZONE });

    expect(signatureKey('Ada Lovelace', 'waiver-1', eveningAtTheSpace)).toBe(
      'waivers/Ada_Lovelace_2026-10-16_waiver-1',
    );
  });
});

describeWithDatabase('WaiverRepository.getAll', () => {
  const database = useTestDatabase('waiver');
  let repository: WaiverRepository;

  beforeEach(() => {
    repository = new WaiverRepository(database.db);
  });

  async function addWaiver(name: string, daysAgo: number) {
    const member = await database.insert.member({ name });
    return await database.insert.waiver({
      memberId: member.id,
      name,
      email: member.email,
      signedDate: DateTime.now().minus({ days: daysAgo }),
    });
  }

  it('finds waivers by signer name, newest first', async () => {
    const older = await addWaiver('Ada Lovelace', 3);
    const newer = await addWaiver('Ada Byron', 1);
    await addWaiver('Grace Hopper', 2);

    const { data, pagination } = await repository.getAll({
      query: 'ada',
      page: 1,
      pageSize: PAGE_SIZE,
    });

    expect(data.map(({ id }) => id)).toEqual([newer.id, older.id]);
    expect(pagination.total).toBe(2);
  });

  it('returns a servable link to the signature', async () => {
    const waiver = await addWaiver('Ada Lovelace', 1);

    const { data } = await repository.getAll({ query: '', page: 1, pageSize: PAGE_SIZE });

    expect(data[0].signatureUrl).toBe(fileUrl(waiver.signatureUrl));
  });
});
