import { PAYMENT_STATUS } from '$lib/utils/billing';
import { SERVICE_REQUEST_STATUS, type ServiceRequestStatus } from '$lib/utils/services';
import { describeWithDatabase, useTestDatabase } from '$test/db';
import { DateTime } from 'luxon';
import { beforeEach, expect, it } from 'vitest';
import { SERVICE_REMINDER, ServiceRepository } from './service.repository';

describeWithDatabase(ServiceRepository.name, () => {
  const database = useTestDatabase('service');
  const NOW = DateTime.fromISO('2026-10-17T08:00Z');
  const CUTOFF = NOW.minus({ days: 3 });
  let repository: ServiceRepository;
  let serviceId: string;

  beforeEach(async () => {
    repository = new ServiceRepository(database.db);
    ({ id: serviceId } = await database.insert.service());
  });

  async function addRequest(
    status: ServiceRequestStatus,
    payment: { status: string; issuedDate?: DateTime } = { status: PAYMENT_STATUS.PENDING },
    request: { completionDate?: DateTime } = {},
  ) {
    const saved = await database.insert.payment(payment as never);
    return await database.insert.serviceRequest({
      serviceId,
      paymentId: saved.id,
      status,
      ...request,
    });
  }

  it('finds requests ready for pickup since before the cutoff', async () => {
    const due = await addRequest(
      SERVICE_REQUEST_STATUS.DONE,
      { status: PAYMENT_STATUS.PAID },
      { completionDate: CUTOFF.minus({ hours: 1 }) },
    );
    await addRequest(
      SERVICE_REQUEST_STATUS.DONE,
      { status: PAYMENT_STATUS.PAID },
      { completionDate: CUTOFF.plus({ hours: 1 }) },
    );
    await addRequest(
      SERVICE_REQUEST_STATUS.PICKED_UP,
      { status: PAYMENT_STATUS.PAID },
      { completionDate: CUTOFF.minus({ days: 1 }) },
    );

    const candidates = await repository.getPickupReminderCandidates(CUTOFF);

    expect(candidates.map(({ request }) => request.id)).toEqual([due.id]);
  });

  it('finds open requests whose bill was issued before the cutoff and is still unpaid', async () => {
    const due = await addRequest(SERVICE_REQUEST_STATUS.IN_PROGRESS, {
      status: PAYMENT_STATUS.PENDING,
      issuedDate: CUTOFF.minus({ hours: 1 }),
    });
    await addRequest(SERVICE_REQUEST_STATUS.IN_PROGRESS, {
      status: PAYMENT_STATUS.PENDING,
      issuedDate: CUTOFF.plus({ hours: 1 }),
    });
    await addRequest(SERVICE_REQUEST_STATUS.IN_PROGRESS, {
      status: PAYMENT_STATUS.PAID,
      issuedDate: CUTOFF.minus({ days: 1 }),
    });
    await addRequest(SERVICE_REQUEST_STATUS.CANCELED, {
      status: PAYMENT_STATUS.PENDING,
      issuedDate: CUTOFF.minus({ days: 1 }),
    });

    const candidates = await repository.getPaymentReminderCandidates(CUTOFF);

    expect(candidates.map(({ request }) => request.id)).toEqual([due.id]);
  });

  it('claims each kind of reminder once until it is released', async () => {
    const request = await addRequest(SERVICE_REQUEST_STATUS.DONE);

    expect(await repository.claimReminder(request.id, SERVICE_REMINDER.PICKUP, NOW)).toBe(true);
    expect(await repository.claimReminder(request.id, SERVICE_REMINDER.PICKUP, NOW)).toBe(false);
    expect(await repository.claimReminder(request.id, SERVICE_REMINDER.PAYMENT, NOW)).toBe(true);

    await repository.releaseReminder(request.id, SERVICE_REMINDER.PICKUP);
    expect(await repository.claimReminder(request.id, SERVICE_REMINDER.PICKUP, NOW)).toBe(true);
  });
});
