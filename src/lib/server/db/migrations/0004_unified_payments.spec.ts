import {
  describeWithDatabase,
  runMigrationFile,
  runMigrationFiles,
  useEmptyDatabase,
} from '$test/db';
import { beforeAll, expect, it } from 'vitest';

describeWithDatabase('unified payments migration', () => {
  const database = useEmptyDatabase('unified_payments_migration');
  const SQUARE_ORDER = {
    lineItems: [
      { name: '3D Print Request', quantity: '1', basePriceMoney: { amount: '700' } },
      { name: 'Additional Build Plate', quantity: '2', basePriceMoney: { amount: '250' } },
    ],
    discounts: [{ name: 'Member Discount', appliedMoney: { amount: '120' } }],
  };

  beforeAll(async () => {
    await runMigrationFiles(database.sql, [
      '0000_baseline',
      '0001_car_bay_booking',
      '0002_member_management',
      '0003_car_bay_closure',
    ]);

    await database.sql`INSERT INTO "user" (email, name, picture) VALUES ('teacher@example.com', 'T', 'p')`;
    await database.sql`INSERT INTO organization (id, name, email) VALUES ('org-1', 'Acme', 'acme@example.com')`;
    await database.sql`INSERT INTO print_material (id, name) VALUES ('pla', 'PLA')`;
    await database.sql`
      INSERT INTO billing_code (id, code, description, organization_id, discount_id) VALUES
        ('code-org', 'ACME', 'Acme', 'org-1', NULL),
        ('code-discount', 'STUDENT', 'Students', NULL, 'square-discount')
    `;
    await database.sql`
      INSERT INTO payment (id, issued_date, status, type, total, square_invoice_id, payment_url, order_object)
      VALUES ('print-payment', now(), 'pending', 'print_request', 1080, 'invoice-1',
        'https://square.link/u/1', ${JSON.stringify(SQUARE_ORDER)})
    `;
    await database.sql`
      INSERT INTO print_request ("submissionDate", id, email, customer_name, project_name, status, material, special_requests, payment_id)
      VALUES (now(), 'print-1', 'jane@example.com', 'Jane Doe', 'Arm', 'printing', 'pla', '', 'print-payment')
    `;
    await database.sql`
      INSERT INTO payment (id, issued_date, status, type, total, organization_id) VALUES
        ('balance-1', now(), 'pending', 'balance', 5000, 'org-1'),
        ('charge-payment', now(), 'paid', 'org_charge', 2500, 'org-1')
    `;
    await database.sql`
      INSERT INTO organization_charge (id, organization_id, creation_date, description, payment_id)
      VALUES ('charge-1', 'org-1', now(), 'Laser time', 'charge-payment')
    `;
    await database.sql`
      INSERT INTO class_catalog (id, name, description, price, created_date)
      VALUES ('welding', 'Welding 101', '', 4000, now())
    `;
    await database.sql`
      INSERT INTO class_instance (id, class_id, teacher_email, date, start_time, duration_minutes, seats, created_date)
      VALUES ('class-1', 'welding', 'teacher@example.com', '2026-11-01', '18:00', 60, 5, now())
    `;
    await database.sql`
      INSERT INTO class_booking (id, instance_id, customer_name, customer_email, customer_phone,
        square_payment_id, status, quantity, amount_paid, booking_token, created_date) VALUES
        ('class-paid', 'class-1', 'Ann', 'ann@example.com', '1', 'sq-1', 'confirmed', 2, 8000, 't1', now()),
        ('class-canceled', 'class-1', 'Bo', 'bo@example.com', '1', 'sq-2', 'canceled', 1, 4000, 't2', now()),
        ('class-free', 'class-1', 'Cy', 'cy@example.com', '1', NULL, 'confirmed', 1, 0, 't3', now()),
        ('class-uneven', 'class-1', 'Di', 'di@example.com', '1', 'sq-9', 'confirmed', 3, 10000, 't6', now())
    `;
    await database.sql`
      INSERT INTO car_bay_booking (id, tier, status, start_at, end_at, blocked_until, is_member,
        customer_name, customer_email, customer_phone, amount_paid, square_payment_id,
        square_order_id, booking_token, created_date) VALUES
        ('bay-paid', 'hourly', 'confirmed', now(), now() + interval '2 hours',
          now() + interval '3 hours', true, 'Dee', 'dee@example.com', '1', 2000, 'sq-3', 'order-3', 't4', now()),
        ('bay-staff', 'quick_job', 'confirmed', now() + interval '1 day', now() + interval '25 hours',
          now() + interval '26 hours', false, 'Eve', 'eve@example.com', '1', 0, NULL, NULL, 't5', now())
    `;
    await database.sql`
      INSERT INTO payment (id, issued_date, status, type, total, square_invoice_id, car_bay_booking_id)
      VALUES ('overrun-1', now(), 'pending', 'car_bay_overrun', 1500, 'invoice-2', 'bay-paid')
    `;

    await runMigrationFile(database.sql, '0004_unified_payments');
  });

  async function paymentRow(id: string) {
    const [row] = await database.sql`
      SELECT type, status, total, customer_name, customer_email, line_items, discounts,
        square_payment_id, square_invoice_id, payment_url
      FROM payment WHERE id = ${id}
    `;
    return row;
  }

  it('turns a Square print order into line items and discounts', async () => {
    expect(await paymentRow('print-payment')).toMatchObject({
      customer_name: 'Jane Doe',
      customer_email: 'jane@example.com',
      line_items: [
        { name: '3D Print Request', quantity: 1, unitAmount: 700 },
        { name: 'Additional Build Plate', quantity: 2, unitAmount: 250 },
      ],
      discounts: [{ name: 'Member Discount', amount: 120 }],
      square_invoice_id: 'invoice-1',
      payment_url: 'https://square.link/u/1',
    });
  });

  it('gives organization payments a line item and the organization as customer', async () => {
    expect(await paymentRow('balance-1')).toMatchObject({
      customer_name: 'Acme',
      line_items: [{ name: 'Organization Balance Payment', quantity: 1, unitAmount: 5000 }],
    });
    expect(await paymentRow('charge-payment')).toMatchObject({
      line_items: [{ name: 'Laser time', quantity: 1, unitAmount: 2500 }],
    });
  });

  it('moves paid class bookings into payments', async () => {
    expect(await paymentRow('class-paid')).toMatchObject({
      type: 'class_booking',
      status: 'paid',
      total: 8000,
      square_payment_id: 'sq-1',
      line_items: [{ name: 'Welding 101', quantity: 2, unitAmount: 4000 }],
    });
    expect((await paymentRow('class-canceled')).status).toBe('refunded');

    const bookings = await database.sql`SELECT id, payment_id FROM class_booking ORDER BY id`;
    expect(bookings).toEqual([
      { id: 'class-canceled', payment_id: 'class-canceled' },
      { id: 'class-free', payment_id: null },
      { id: 'class-paid', payment_id: 'class-paid' },
      { id: 'class-uneven', payment_id: 'class-uneven' },
    ]);
  });

  it('keeps a class total that does not split evenly per seat as one line', async () => {
    expect(await paymentRow('class-uneven')).toMatchObject({
      total: 10000,
      line_items: [{ name: 'Welding 101 (3 seats)', quantity: 1, unitAmount: 10000 }],
    });
  });

  it('moves paid car bay bookings and their overruns into payments', async () => {
    expect(await paymentRow('bay-paid')).toMatchObject({
      type: 'car_bay_booking',
      status: 'paid',
      total: 2000,
      customer_email: 'dee@example.com',
      line_items: [{ name: 'Car Bay - Hourly', quantity: 1, unitAmount: 2000 }],
    });
    expect((await paymentRow('overrun-1')).customer_email).toBe('dee@example.com');

    const [overrun] = await database.sql`SELECT booking_id, payment_id FROM car_bay_overrun`;
    expect(overrun).toEqual({ booking_id: 'bay-paid', payment_id: 'overrun-1' });

    const bookings = await database.sql`SELECT id, payment_id FROM car_bay_booking ORDER BY id`;
    expect(bookings).toEqual([
      { id: 'bay-paid', payment_id: 'bay-paid' },
      { id: 'bay-staff', payment_id: null },
    ]);
  });

  it('archives group codes that only gave a discount', async () => {
    const codes = await database.sql`SELECT code, archived FROM billing_code ORDER BY code`;

    expect(codes).toEqual([
      { code: 'ACME', archived: false },
      { code: 'STUDENT', archived: true },
    ]);
  });
});
