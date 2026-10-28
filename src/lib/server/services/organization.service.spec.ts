import type { Payment } from '$lib/server/db/schema';
import { MailgunRateLimitError } from '$lib/server/repositories/mailgun.repository';
import { SPACE_ZONE } from '$lib/server/utils/member_access';
import { PAYMENT_STATUS, PAYMENT_TYPE } from '$lib/utils/billing';
import { factory } from '$test/factory';
import { newTestService, type ServiceMocks } from '$test/utils';
import { DateTime } from 'luxon';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ORGANIZATION_NOT_FOUND, OrganizationService } from './organization.service';

const PAY_URL = 'https://orion.example.com/pay';

function payment(total: number, status: Payment['status'], type: Payment['type']) {
  return factory.payment({ total, status, type });
}

describe(OrganizationService.name, () => {
  let sut: OrganizationService;
  let mocks: ServiceMocks;

  beforeEach(() => {
    ({ sut, mocks } = newTestService(OrganizationService));
  });

  describe('getOrganizations', () => {
    it('should return all non-archived organizations', async () => {
      const organizations = [factory.organization(), factory.organization()];
      mocks.organizationRepository.getAll.mockResolvedValue(organizations);

      const result = await sut.getOrganizations();

      expect(mocks.organizationRepository.getAll).toHaveBeenCalled();
      expect(result).toEqual(organizations);
    });

    it('should return empty array when no organizations exist', async () => {
      mocks.organizationRepository.getAll.mockResolvedValue([]);

      const result = await sut.getOrganizations();

      expect(result).toEqual([]);
    });
  });

  describe('getOrganizationById', () => {
    it('should return organization by id', async () => {
      const organization = factory.organization();
      mocks.organizationRepository.getById.mockResolvedValue(organization);

      const result = await sut.getOrganizationById(organization.id);

      expect(mocks.organizationRepository.getById).toHaveBeenCalledWith(organization.id);
      expect(result).toEqual(organization);
    });

    it('should return null when organization not found', async () => {
      mocks.organizationRepository.getById.mockResolvedValue(null as never);

      const result = await sut.getOrganizationById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getOrganizationDetail', () => {
    it('should return organization detail with outstanding balance, print requests, and payments', async () => {
      const organization = factory.organization({ name: 'Detail Org', email: 'detail@org.com' });
      const printPayments = [
        payment(5000, PAYMENT_STATUS.PENDING, PAYMENT_TYPE.PRINT_REQUEST),
        payment(3000, PAYMENT_STATUS.PENDING, PAYMENT_TYPE.PRINT_REQUEST),
      ];
      const balancePayment = payment(2000, PAYMENT_STATUS.PAID, PAYMENT_TYPE.BALANCE);
      const chargePayment = payment(1000, PAYMENT_STATUS.PAID, PAYMENT_TYPE.ORG_CHARGE);
      mocks.organizationRepository.getById.mockResolvedValue(organization);
      mocks.organizationRepository.getPayments.mockResolvedValue([
        payment(5000, PAYMENT_STATUS.PAID, PAYMENT_TYPE.PRINT_REQUEST),
        payment(3000, PAYMENT_STATUS.PAID, PAYMENT_TYPE.PRINT_REQUEST),
        balancePayment,
        chargePayment,
      ]);
      mocks.organizationRepository.getPrintRequests.mockResolvedValue([
        { ...factory.printRequest({ status: 'done' }), payment: printPayments[0] },
        { ...factory.printRequest({ status: 'in_queue' }), payment: printPayments[1] },
      ]);
      mocks.organizationRepository.getCharges.mockResolvedValue([
        {
          ...factory.organizationCharge({
            organizationId: organization.id,
            description: 'Misc Charge',
          }),
          payment: chargePayment,
        },
      ]);
      mocks.organizationRepository.getBalancePayments.mockResolvedValue([balancePayment]);

      const result = await sut.getOrganizationDetail(organization.id);

      expect(mocks.organizationRepository.getById).toHaveBeenCalledWith(organization.id);
      expect(mocks.organizationRepository.getPayments).toHaveBeenCalledWith(organization.id);
      expect(mocks.organizationRepository.getPrintRequests).toHaveBeenCalledWith(organization.id);
      expect(mocks.organizationRepository.getCharges).toHaveBeenCalledWith(organization.id);
      expect(mocks.organizationRepository.getBalancePayments).toHaveBeenCalledWith(organization.id);
      expect(result.id).toBe(organization.id);
      expect(result.name).toBe('Detail Org');
      expect(result.email).toBe('detail@org.com');
      expect(result.outstandingBalance).toBe(7000);
      expect(result.charges).toHaveLength(3);
      expect(result.charges.some((c) => c.type === 'print')).toBe(true);
      expect(result.charges.some((c) => c.type === 'charge')).toBe(true);
      expect(result.balancePayments).toEqual([balancePayment]);
    });

    it('should throw error when organization not found', async () => {
      mocks.organizationRepository.getById.mockResolvedValue(null as never);

      await expect(sut.getOrganizationDetail('nonexistent')).rejects.toThrow(
        'Organization not found',
      );
    });

    it('should return organization detail with zero balance when no payments exist', async () => {
      const organization = factory.organization();
      mocks.organizationRepository.getById.mockResolvedValue(organization);
      mocks.organizationRepository.getPayments.mockResolvedValue([]);
      mocks.organizationRepository.getPrintRequests.mockResolvedValue([]);
      mocks.organizationRepository.getCharges.mockResolvedValue([]);
      mocks.organizationRepository.getBalancePayments.mockResolvedValue([]);

      const result = await sut.getOrganizationDetail(organization.id);

      expect(result.outstandingBalance).toBe(0);
      expect(result.charges).toEqual([]);
      expect(result.balancePayments).toEqual([]);
    });
  });

  describe('createOrganization', () => {
    it('should create a new organization', async () => {
      const dto = { name: 'New Organization', email: 'new@org.com' };
      const created = factory.organization(dto);
      mocks.organizationRepository.create.mockResolvedValue(created);

      const result = await sut.createOrganization(dto);

      expect(mocks.organizationRepository.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(created);
    });
  });

  describe('updateOrganization', () => {
    it('should update an existing organization', async () => {
      const updates = { name: 'Updated Name', email: 'updated@org.com' };
      const updated = factory.organization(updates);
      mocks.organizationRepository.update.mockResolvedValue(updated);

      const result = await sut.updateOrganization(updated.id, updates);

      expect(mocks.organizationRepository.update).toHaveBeenCalledWith(updated.id, updates);
      expect(result).toEqual(updated);
    });

    it('should update only email', async () => {
      const updates = { email: 'newemail@org.com' };
      const updated = factory.organization(updates);
      mocks.organizationRepository.update.mockResolvedValue(updated);

      const result = await sut.updateOrganization(updated.id, updates);

      expect(mocks.organizationRepository.update).toHaveBeenCalledWith(updated.id, updates);
      expect(result.email).toBe('newemail@org.com');
    });

    describe('access end date', () => {
      const organization = factory.organization();

      beforeEach(() => {
        mocks.organizationRepository.update.mockResolvedValue(organization);
      });

      it('stores the end of the chosen day in the space time zone', async () => {
        await sut.updateOrganization(organization.id, { accessEndDate: '2026-12-15' });

        const { accessEndDate } = mocks.organizationRepository.update.mock.calls[0][1];
        expect(accessEndDate?.zoneName).toBe(SPACE_ZONE);
        expect(accessEndDate?.toISO()).toBe('2026-12-15T23:59:59.999-06:00');
      });

      it('clears the end date when null', async () => {
        await sut.updateOrganization(organization.id, { accessEndDate: null });

        expect(mocks.organizationRepository.update).toHaveBeenCalledWith(organization.id, {
          accessEndDate: null,
        });
      });

      it('switches member access off without touching the end date', async () => {
        await sut.updateOrganization(organization.id, { grantsAccess: false });

        expect(mocks.organizationRepository.update).toHaveBeenCalledWith(organization.id, {
          grantsAccess: false,
        });
      });
    });
  });

  describe('archiveOrganization', () => {
    it('should archive an organization', async () => {
      mocks.organizationRepository.archive.mockResolvedValue(undefined);

      await sut.archiveOrganization('org-archive');

      expect(mocks.organizationRepository.archive).toHaveBeenCalledWith('org-archive');
    });
  });

  describe('getOutstandingBalance', () => {
    it('should calculate outstanding balance correctly with paid print requests', async () => {
      mocks.organizationRepository.getPayments.mockResolvedValue([
        payment(5000, PAYMENT_STATUS.PAID, PAYMENT_TYPE.PRINT_REQUEST),
        payment(3000, PAYMENT_STATUS.PAID, PAYMENT_TYPE.PRINT_REQUEST),
      ]);

      const result = await sut.getOutstandingBalance('org-123');

      expect(mocks.organizationRepository.getPayments).toHaveBeenCalledWith('org-123');
      expect(result).toBe(8000);
    });

    it('should subtract balance payments from outstanding balance', async () => {
      mocks.organizationRepository.getPayments.mockResolvedValue([
        payment(5000, PAYMENT_STATUS.PAID, PAYMENT_TYPE.PRINT_REQUEST),
        payment(3000, PAYMENT_STATUS.PAID, PAYMENT_TYPE.PRINT_REQUEST),
        payment(2000, PAYMENT_STATUS.PAID, PAYMENT_TYPE.BALANCE),
      ]);

      const result = await sut.getOutstandingBalance('org-123');

      expect(result).toBe(6000);
    });

    it('should only count non quote or canceled payments', async () => {
      mocks.organizationRepository.getPayments.mockResolvedValue([
        payment(5000, PAYMENT_STATUS.PAID, PAYMENT_TYPE.PRINT_REQUEST),
        payment(3000, PAYMENT_STATUS.PENDING, PAYMENT_TYPE.PRINT_REQUEST),
        payment(4000, PAYMENT_STATUS.QUOTE, PAYMENT_TYPE.PRINT_REQUEST),
        payment(2000, PAYMENT_STATUS.CANCELED, PAYMENT_TYPE.PRINT_REQUEST),
      ]);

      const result = await sut.getOutstandingBalance('org-123');

      expect(result).toBe(8000);
    });

    it('should return 0 when no payments exist', async () => {
      mocks.organizationRepository.getPayments.mockResolvedValue([]);

      const result = await sut.getOutstandingBalance('org-empty');

      expect(result).toBe(0);
    });

    it('should return negative balance when balance payments exceed print payments', async () => {
      mocks.organizationRepository.getPayments.mockResolvedValue([
        payment(1000, PAYMENT_STATUS.PAID, PAYMENT_TYPE.PRINT_REQUEST),
        payment(2000, PAYMENT_STATUS.PAID, PAYMENT_TYPE.BALANCE),
      ]);

      const result = await sut.getOutstandingBalance('org-overpaid');

      expect(result).toBe(-1000);
    });

    it('should handle multiple balance payments', async () => {
      mocks.organizationRepository.getPayments.mockResolvedValue([
        payment(10000, PAYMENT_STATUS.PAID, PAYMENT_TYPE.PRINT_REQUEST),
        payment(3000, PAYMENT_STATUS.PAID, PAYMENT_TYPE.BALANCE),
        payment(2000, PAYMENT_STATUS.PAID, PAYMENT_TYPE.BALANCE),
        payment(5000, PAYMENT_STATUS.PAID, PAYMENT_TYPE.PRINT_REQUEST),
      ]);

      const result = await sut.getOutstandingBalance('org-multi');

      expect(result).toBe(10000);
    });

    it('should include organization charges in outstanding balance', async () => {
      mocks.organizationRepository.getPayments.mockResolvedValue([
        payment(5000, PAYMENT_STATUS.PAID, PAYMENT_TYPE.PRINT_REQUEST),
        payment(2000, PAYMENT_STATUS.PAID, PAYMENT_TYPE.BALANCE),
        payment(1500, PAYMENT_STATUS.PAID, PAYMENT_TYPE.ORG_CHARGE),
        payment(500, PAYMENT_STATUS.PAID, PAYMENT_TYPE.ORG_CHARGE),
      ]);

      const result = await sut.getOutstandingBalance('org-123');

      expect(result).toBe(5000);
    });
  });

  describe('chargeBalance', () => {
    const organization = factory.organization({ name: 'Charge Org', email: 'charge@org.com' });

    beforeEach(() => {
      mocks.organizationRepository.getById.mockResolvedValue(organization);
      mocks.organizationRepository.getPayments.mockResolvedValue([
        payment(5000, PAYMENT_STATUS.PAID, PAYMENT_TYPE.PRINT_REQUEST),
        payment(3000, PAYMENT_STATUS.PENDING, PAYMENT_TYPE.PRINT_REQUEST),
      ]);
      mocks.paymentRepository.save.mockImplementation(async (data, id) =>
        factory.payment({ id, total: data.bill.total, paymentUrl: data.paymentUrl }),
      );
      mocks.mailgunRepository.sendTemplate.mockResolvedValue(undefined as never);
    });

    it('saves a pending balance payment and emails the organization a pay link', async () => {
      const result = await sut.chargeBalance({ organizationId: organization.id });

      const [saved, id] = mocks.paymentRepository.save.mock.calls[0];
      expect(saved).toEqual({
        type: PAYMENT_TYPE.BALANCE,
        status: PAYMENT_STATUS.PENDING,
        customer: { name: 'Charge Org', email: 'charge@org.com' },
        bill: expect.objectContaining({
          lineItems: [{ name: 'Organization Balance Payment', quantity: 1, unitAmount: 8000 }],
          total: 8000,
        }),
        organizationId: organization.id,
        paymentUrl: `${PAY_URL}/${id}`,
      });
      expect(mocks.mailgunRepository.sendTemplate).toHaveBeenCalledWith(
        'charge@org.com',
        expect.any(String),
        expect.any(String),
        'payment_request',
        expect.objectContaining({
          customerName: 'Charge Org',
          total: '80.00',
          paymentUrl: `${PAY_URL}/${id}`,
        }),
      );
      expect(result.id).toBe(id);
    });

    it('throws when the organization does not exist', async () => {
      mocks.organizationRepository.getById.mockResolvedValue(null as never);

      await expect(sut.chargeBalance({ organizationId: 'nonexistent' })).rejects.toThrow(
        'Organization not found',
      );
    });

    it('throws when nothing is owed', async () => {
      mocks.organizationRepository.getPayments.mockResolvedValue([
        payment(1000, PAYMENT_STATUS.PAID, PAYMENT_TYPE.PRINT_REQUEST),
        payment(2000, PAYMENT_STATUS.PAID, PAYMENT_TYPE.BALANCE),
      ]);

      await expect(sut.chargeBalance({ organizationId: organization.id })).rejects.toThrow(
        'No outstanding balance to charge',
      );
      expect(mocks.paymentRepository.save).not.toHaveBeenCalled();
      expect(mocks.mailgunRepository.sendTemplate).not.toHaveBeenCalled();
    });
  });

  describe('createCharge', () => {
    it('records the charge against the organization', async () => {
      const organization = factory.organization();
      mocks.organizationRepository.getById.mockResolvedValue(organization);
      mocks.organizationRepository.createCharge.mockResolvedValue(
        factory.organizationCharge({ organizationId: organization.id }),
      );
      const dto = { organizationId: organization.id, description: 'Laser time', amount: 2500 };

      await sut.createCharge(dto);

      expect(mocks.organizationRepository.createCharge).toHaveBeenCalledWith(dto, organization);
    });

    it('throws when the organization does not exist', async () => {
      mocks.organizationRepository.getById.mockResolvedValue(undefined as never);

      await expect(
        sut.createCharge({ organizationId: 'x', description: 'd', amount: 1 }),
      ).rejects.toThrow(ORGANIZATION_NOT_FOUND);
    });
  });

  describe('addOrganizationMembers', () => {
    const organization = factory.organization({ name: 'Robotics Club' });

    beforeEach(() => {
      mocks.organizationRepository.getById.mockResolvedValue(organization);
      mocks.memberRepository.upsertByEmail.mockImplementation(async (name, email) =>
        factory.member({ id: `id-${email}`, name, email }),
      );
      mocks.organizationMemberRepository.add.mockImplementation(async (organizationId, memberId) =>
        factory.organizationMember({ id: `membership-${memberId}`, organizationId, memberId }),
      );
      mocks.memberNotificationRepository.sendOnboarding.mockResolvedValue(undefined);
    });

    it('adds each parsed member and sends onboarding', async () => {
      const result = await sut.addOrganizationMembers({
        organizationId: organization.id,
        lines: 'Ada <ada@example.com>\nGrace, grace@example.com',
      });

      expect(mocks.memberRepository.upsertByEmail).toHaveBeenCalledWith('Ada', 'ada@example.com');
      expect(mocks.organizationMemberRepository.add).toHaveBeenCalledWith(
        organization.id,
        'id-ada@example.com',
      );
      await vi.waitFor(() =>
        expect(mocks.memberNotificationRepository.sendOnboarding).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'id-grace@example.com' }),
          'organization',
        ),
      );
      expect(result.added.map((line) => line.email)).toEqual([
        'ada@example.com',
        'grace@example.com',
      ]);
      expect(result.errors).toEqual([]);
    });

    it('skips onboarding for existing members', async () => {
      mocks.organizationMemberRepository.add.mockResolvedValue(undefined);

      const result = await sut.addOrganizationMembers({
        organizationId: organization.id,
        lines: 'Ada <ada@example.com>',
      });

      expect(mocks.memberNotificationRepository.sendOnboarding).not.toHaveBeenCalled();
      expect(result.alreadyMembers).toHaveLength(1);
      expect(result.added).toEqual([]);
    });

    it('reports unparseable lines and still adds the rest', async () => {
      const result = await sut.addOrganizationMembers({
        organizationId: organization.id,
        lines: 'nonsense\nAda <ada@example.com>',
      });

      expect(result.errors).toEqual([expect.objectContaining({ line: 1, text: 'nonsense' })]);
      expect(result.added).toHaveLength(1);
    });

    it('keeps the membership when the onboarding email fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mocks.memberNotificationRepository.sendOnboarding.mockRejectedValue(new Error('mailgun'));

      const result = await sut.addOrganizationMembers({
        organizationId: organization.id,
        lines: 'Ada <ada@example.com>\nGrace <grace@example.com>',
      });

      expect(result.added).toHaveLength(2);
    });

    it('throws when the organization does not exist', async () => {
      mocks.organizationRepository.getById.mockResolvedValue(undefined as never);

      await expect(
        sut.addOrganizationMembers({ organizationId: 'missing', lines: 'Ada <a@b.co>' }),
      ).rejects.toThrow(ORGANIZATION_NOT_FOUND);
      expect(mocks.memberRepository.upsertByEmail).not.toHaveBeenCalled();
    });
  });

  describe('sendOrganizationOnboardings', () => {
    const ada = factory.member({ id: 'ada', email: 'ada@example.com' });
    const grace = factory.member({ id: 'grace', email: 'grace@example.com' });

    beforeEach(() => {
      mocks.memberNotificationRepository.sendOnboarding.mockResolvedValue(undefined);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function sentMemberIds() {
      return mocks.memberNotificationRepository.sendOnboarding.mock.calls.map(
        ([member]) => member.id,
      );
    }

    it('waits out the Mailgun rate limit and resends', async () => {
      vi.useFakeTimers();
      mocks.memberNotificationRepository.sendOnboarding.mockRejectedValueOnce(
        new MailgunRateLimitError('limit', DateTime.now().plus({ minutes: 2 })),
      );

      const sending = sut.sendOrganizationOnboardings([ada, grace]);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(mocks.memberNotificationRepository.sendOnboarding).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(60_000);
      await sending;
      expect(sentMemberIds()).toEqual(['ada', 'ada', 'grace']);
    });

    it('moves on to the next member after a non rate limit failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mocks.memberNotificationRepository.sendOnboarding.mockRejectedValueOnce(new Error('mailgun'));

      await sut.sendOrganizationOnboardings([ada, grace]);

      expect(sentMemberIds()).toEqual(['ada', 'grace']);
    });
  });

  describe('removeOrganizationMembers', () => {
    it('removes the memberships within the organization', async () => {
      mocks.organizationMemberRepository.removeMany.mockResolvedValue(undefined);

      await sut.removeOrganizationMembers('org-1', ['m1', 'm2']);

      expect(mocks.organizationMemberRepository.removeMany).toHaveBeenCalledWith('org-1', [
        'm1',
        'm2',
      ]);
    });
  });
});
