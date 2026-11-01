import { PASS_KIND } from '$lib/member_enums';
import { schema } from '$lib/server/db/schema';
import { describeWithDatabase, useTestDatabase } from '$test/db';
import { factory } from '$test/factory';
import { eq } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { beforeEach, expect, it } from 'vitest';
import { PassRepository } from './pass.repository';

describeWithDatabase(PassRepository.name, () => {
  const database = useTestDatabase('pass');
  let repository: PassRepository;

  async function addClassBooking(memberId: string | null) {
    const teacher = await database.insert.user();
    const catalog = await database.insert.classCatalog();
    const instance = await database.insert.classInstance({
      classId: catalog.id,
      teacherEmail: teacher.email,
    });
    const booking = await database.insert.classBooking({ instanceId: instance.id, memberId });
    return { catalog, instance, booking };
  }

  beforeEach(() => {
    repository = new PassRepository(database.db);
  });

  it('returns undefined for an unknown token', async () => {
    expect(await repository.getByToken(crypto.randomUUID())).toBeUndefined();
  });

  it('finds a membership by the member pass token', async () => {
    const member = await database.insert.member();

    expect(await repository.getByToken(member.passToken)).toEqual(
      factory.membershipPass({ member }),
    );
  });

  it('finds a day pass with its holder', async () => {
    const member = await database.insert.member();
    const dayPass = await database.insert.dayPass({ memberId: member.id });

    expect(await repository.getByToken(dayPass.passToken)).toMatchObject({
      kind: PASS_KIND.DAY_PASS,
      member: { id: member.id },
      dayPass: { id: dayPass.id },
    });
  });

  it('gives every row its own pass token', async () => {
    const member = await database.insert.member();
    const now = DateTime.now();
    const rows = await database.db
      .insert(schema.dayPass)
      .values([
        { memberId: member.id, squareOrderId: 'order-a', purchasedDate: now },
        { memberId: member.id, squareOrderId: 'order-b', purchasedDate: now },
      ])
      .returning();

    expect(new Set(rows.map((row) => row.passToken)).size).toBe(rows.length);
  });

  it('finds a class pass with its class', async () => {
    const member = await database.insert.member();
    const { booking, instance, catalog } = await addClassBooking(member.id);

    expect(await repository.getByToken(booking.passToken)).toMatchObject({
      kind: PASS_KIND.CLASS,
      member: { id: member.id },
      booking: { id: booking.id },
      instance: { date: instance.date },
      catalog: { name: catalog.name },
    });
  });

  it('finds a car bay pass whose booking has no member yet', async () => {
    const booking = await database.insert.carBayBooking();

    expect(await repository.getByToken(booking.passToken)).toMatchObject({
      kind: PASS_KIND.CAR_BAY,
      member: null,
      booking: { id: booking.id },
    });
  });

  it('links a booking to a member', async () => {
    const member = await database.insert.member();
    const booking = await database.insert.carBayBooking();
    const pass = await repository.getByToken(booking.passToken);
    if (pass?.kind !== PASS_KIND.CAR_BAY) throw new Error('Expected a car bay pass');

    await repository.linkMember(pass, member.id);

    const [linked] = await database.db
      .select({ memberId: schema.carBayBooking.memberId })
      .from(schema.carBayBooking)
      .where(eq(schema.carBayBooking.id, booking.id));
    expect(linked.memberId).toBe(member.id);
  });
});
