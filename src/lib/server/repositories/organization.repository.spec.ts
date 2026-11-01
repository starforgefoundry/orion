import { schema } from '$lib/server/db/schema';
import { PAYMENT_STATUS, PAYMENT_TYPE } from '$lib/utils/billing';
import { describeWithDatabase, useTestDatabase } from '$test/db';
import { beforeEach, expect, it } from 'vitest';
import { OrganizationRepository } from './organization.repository';
import type { NewPayment } from './payment.repository';

const CHARGE: NewPayment = {
  type: PAYMENT_TYPE.ORG_CHARGE,
  status: PAYMENT_STATUS.PAID,
  customer: { name: 'Robotics Club', email: 'robots@example.com' },
  bill: {
    lineItems: [{ name: 'Laser time', quantity: 1, unitAmount: 2500 }],
    discounts: [],
    total: 2500,
  },
};

describeWithDatabase('OrganizationRepository.createCharge', () => {
  const database = useTestDatabase('organization');
  let repository: OrganizationRepository;
  let organizationId: string;

  beforeEach(async () => {
    repository = new OrganizationRepository(database.db);
    ({ id: organizationId } = await repository.create({
      name: 'Robotics Club',
      email: 'robots@example.com',
    }));
  });

  it('stores the charge with a paid payment billed to the organization', async () => {
    await repository.createCharge(organizationId, 'Laser time', CHARGE);

    const [charge] = await repository.getCharges(organizationId);
    expect(charge).toMatchObject({ organizationId, description: 'Laser time' });
    expect(charge.payment).toMatchObject({
      type: PAYMENT_TYPE.ORG_CHARGE,
      status: PAYMENT_STATUS.PAID,
      organizationId,
      customerName: 'Robotics Club',
      lineItems: CHARGE.bill.lineItems,
      total: 2500,
    });
    expect(charge.payment.paymentDate).not.toBeNull();
  });

  it('keeps no payment when the charge cannot be saved', async () => {
    const missingDescription = null as unknown as string;

    await expect(
      repository.createCharge(organizationId, missingDescription, CHARGE),
    ).rejects.toThrow();

    expect(await database.db.select().from(schema.payment)).toEqual([]);
  });
});
