import { BambuddyRepository } from '$lib/server/repositories/bambuddy.repository';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { BillingCodeRepository } from '$lib/server/repositories/billing_code.repository';
import { CarBayRepository } from '$lib/server/repositories/car_bay.repository';
import { ClassRepository } from '$lib/server/repositories/class.repository';
import { DayPassRepository } from '$lib/server/repositories/day_pass.repository';
import { DiscordRepository } from '$lib/server/repositories/discord.repository';
import { GoogleCalendarRepository } from '$lib/server/repositories/google_calendar.repository';
import { InventoryRepository } from '$lib/server/repositories/inventory.repository';
import { MailgunRepository } from '$lib/server/repositories/mailgun.repository';
import { MemberRepository } from '$lib/server/repositories/member.repository';
import { MemberEmailRepository } from '$lib/server/repositories/member_email.repository';
import { MemberNotificationRepository } from '$lib/server/repositories/member_notification.repository';
import { MemberSubscriptionRepository } from '$lib/server/repositories/member_subscription.repository';
import { OrganizationRepository } from '$lib/server/repositories/organization.repository';
import { OrganizationMemberRepository } from '$lib/server/repositories/organization_member.repository';
import { PaymentRepository } from '$lib/server/repositories/payment.repository';
import { PrintFilesRepository } from '$lib/server/repositories/print_files.repository';
import { PrintMaterialsRepository } from '$lib/server/repositories/print_materials.repository';
import { PrintRequestRepository } from '$lib/server/repositories/print_request.repository';
import { PrintRequestCommentRepository } from '$lib/server/repositories/print_request_comment.repository';
import { SettingsRepository } from '$lib/server/repositories/settings.repository';
import { SquareRepository } from '$lib/server/repositories/square.repository';
import { VisitRepository } from '$lib/server/repositories/visit.repository';
import { WaiverRepository } from '$lib/server/repositories/waiver.repository';
import type { BaseService, ServiceRepositories } from '$lib/server/services/base.service';
import { vi, type Mocked } from 'vitest';

type Constructor<T> = abstract new (...args: never[]) => T;

const REPOSITORIES: { [K in keyof ServiceRepositories]: Constructor<ServiceRepositories[K]> } = {
  bambuddyRepository: BambuddyRepository,
  billingCodeRepository: BillingCodeRepository,
  carBayRepository: CarBayRepository,
  classRepository: ClassRepository,
  dayPassRepository: DayPassRepository,
  discordRepository: DiscordRepository,
  googleCalendarRepository: GoogleCalendarRepository,
  inventoryRepository: InventoryRepository,
  mailgunRepository: MailgunRepository,
  memberEmailRepository: MemberEmailRepository,
  memberNotificationRepository: MemberNotificationRepository,
  memberRepository: MemberRepository,
  memberSubscriptionRepository: MemberSubscriptionRepository,
  organizationMemberRepository: OrganizationMemberRepository,
  organizationRepository: OrganizationRepository,
  paymentRepository: PaymentRepository,
  printFilesRepository: PrintFilesRepository,
  printMaterialsRepository: PrintMaterialsRepository,
  printRequestCommentRepository: PrintRequestCommentRepository,
  printRequestRepository: PrintRequestRepository,
  settingsRepository: SettingsRepository,
  squareRepository: SquareRepository,
  visitRepository: VisitRepository,
  waiverRepository: WaiverRepository,
};

export type ServiceMocks = { [K in keyof ServiceRepositories]: Mocked<ServiceRepositories[K]> };

function methodNames(Dependency: Constructor<unknown>) {
  const names = new Set<string>();
  for (
    let prototype = Dependency.prototype;
    prototype && prototype !== BaseRepository.prototype && prototype !== Object.prototype;
    prototype = Object.getPrototypeOf(prototype)
  ) {
    for (const name of Object.getOwnPropertyNames(prototype)) {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
      if (name !== 'constructor' && typeof descriptor?.value === 'function') {
        names.add(name);
      }
    }
  }
  return names;
}

function unimplemented(label: string) {
  return vi.fn(() => {
    throw new Error(`${label} was called without a mock implementation`);
  });
}

/**
 * Mocks every method of a class. With `strict` (the default) a method throws until the test
 * gives it an implementation, so an unexpected call fails instead of returning undefined.
 */
export function automock<T>(Dependency: Constructor<T>, { strict = true } = {}): Mocked<T> {
  const mock: Record<string, unknown> = {};
  for (const name of methodNames(Dependency)) {
    mock[name] = strict ? unimplemented(`${Dependency.name}.${name}`) : vi.fn();
  }
  return mock as Mocked<T>;
}

export function newServiceMocks(): ServiceMocks {
  const entries = Object.entries(REPOSITORIES).map(([key, Repository]) => [
    key,
    automock(Repository as Constructor<unknown>),
  ]);
  return Object.fromEntries(entries) as ServiceMocks;
}

export function newTestService<T extends BaseService>(
  Service: new (repositories: Partial<ServiceRepositories>) => T,
) {
  const mocks = newServiceMocks();
  const sut = new Service(mocks as unknown as ServiceRepositories);
  return { sut, mocks };
}
