import { PAYMENT_STATUS } from '$lib/utils/billing';
import { SERVICE_REQUEST_STATUS, type ServiceRequestStatus } from '$lib/utils/services';
import { describeWithDatabase, useTestDatabase } from '$test/db';
import { DateTime } from 'luxon';
import { beforeEach, expect, it } from 'vitest';
import { ServiceRepository } from './service.repository';

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

  async function addRequest(status: ServiceRequestStatus, completionDate?: DateTime) {
    const payment = await database.insert.payment({ status: PAYMENT_STATUS.PAID });
    return await database.insert.serviceRequest({
      serviceId,
      paymentId: payment.id,
      status,
      completionDate: completionDate ?? null,
    });
  }

  it('finds requests ready for pickup since before the cutoff', async () => {
    const due = await addRequest(SERVICE_REQUEST_STATUS.DONE, CUTOFF.minus({ hours: 1 }));
    await addRequest(SERVICE_REQUEST_STATUS.DONE, CUTOFF.plus({ hours: 1 }));
    await addRequest(SERVICE_REQUEST_STATUS.PICKED_UP, CUTOFF.minus({ days: 1 }));

    const candidates = await repository.getPickupReminderCandidates(CUTOFF);

    expect(candidates.map(({ request }) => request.id)).toEqual([due.id]);
  });

  it('claims the pickup reminder once until it is released', async () => {
    const request = await addRequest(SERVICE_REQUEST_STATUS.DONE, CUTOFF.minus({ hours: 1 }));

    expect(await repository.claimPickupReminder(request.id, NOW)).toBe(true);
    expect(await repository.claimPickupReminder(request.id, NOW)).toBe(false);
    expect(await repository.getPickupReminderCandidates(CUTOFF)).toEqual([]);

    await repository.releasePickupReminder(request.id);
    expect(await repository.claimPickupReminder(request.id, NOW)).toBe(true);
  });
});
