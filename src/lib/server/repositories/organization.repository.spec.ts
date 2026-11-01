import type { Database } from '$lib/server/db';
import { schema } from '$lib/server/db/schema';
import { PAYMENT_STATUS, PAYMENT_TYPE } from '$lib/utils/billing';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { OrganizationRepository } from './organization.repository';
import type { NewPayment } from './payment.repository';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../db/migrations');
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
// migrations.spec.ts resets TEST_DATABASE_URL itself, so this suite uses its own database.
const DATABASE_NAME = 'orion_organization_test';

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

describe.skipIf(!TEST_DATABASE_URL)('OrganizationRepository.createCharge', () => {
  const admin = postgres(TEST_DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
  const url = new URL(TEST_DATABASE_URL ?? 'postgres://localhost');
  url.pathname = `/${DATABASE_NAME}`;
  let sql: postgres.Sql;
  let db: Database;
  let repository: OrganizationRepository;
  let organizationId: string;

  beforeAll(async () => {
    await admin.unsafe(`DROP DATABASE IF EXISTS ${DATABASE_NAME} WITH (FORCE)`);
    await admin.unsafe(`CREATE DATABASE ${DATABASE_NAME}`);
    sql = postgres(url.toString(), { max: 1, onnotice: () => {} });
    db = drizzle(sql);
    await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
    repository = new OrganizationRepository(db);
  });

  afterAll(async () => {
    await sql?.end();
    await admin.unsafe(`DROP DATABASE IF EXISTS ${DATABASE_NAME} WITH (FORCE)`);
    await admin.end();
  });

  beforeEach(async () => {
    await db.delete(schema.organizationCharge);
    await db.delete(schema.payment);
    await db.delete(schema.organization);
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

    expect(await db.select().from(schema.payment)).toEqual([]);
  });
});
