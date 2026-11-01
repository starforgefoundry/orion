import { PaymentGateway } from '$lib/server/gateways/payment.gateway';
import { MailgunGateway } from '$lib/server/gateways/mailgun.gateway';
import { MemberNotificationGateway } from '$lib/server/gateways/member-notification.gateway';
import { BambuddyRepository } from '$lib/server/repositories/bambuddy.repository';
import { BillingCodeRepository } from '$lib/server/repositories/billing-code.repository';
import { CarBayRepository } from '$lib/server/repositories/car-bay.repository';
import { ClassRepository } from '$lib/server/repositories/class.repository';
import { DayPassRepository } from '$lib/server/repositories/day-pass.repository';
import { DiscordRepository } from '$lib/server/repositories/discord.repository';
import { EmailTemplateRepository } from '$lib/server/repositories/email-template.repository';
import { GoogleCalendarRepository } from '$lib/server/repositories/google-calendar.repository';
import { InventoryRepository } from '$lib/server/repositories/inventory.repository';
import { MemberRepository } from '$lib/server/repositories/member.repository';
import { MemberEmailRepository } from '$lib/server/repositories/member-email.repository';
import { MemberSubscriptionRepository } from '$lib/server/repositories/member-subscription.repository';
import { OrganizationRepository } from '$lib/server/repositories/organization.repository';
import { OrganizationMemberRepository } from '$lib/server/repositories/organization-member.repository';
import { PassRepository } from '$lib/server/repositories/pass.repository';
import { PaymentRepository } from '$lib/server/repositories/payment.repository';
import { PrintFilesRepository } from '$lib/server/repositories/print-files.repository';
import { PrintMaterialsRepository } from '$lib/server/repositories/print-materials.repository';
import { PrintRequestRepository } from '$lib/server/repositories/print-request.repository';
import { PrintRequestCommentRepository } from '$lib/server/repositories/print-request-comment.repository';
import { SettingsRepository } from '$lib/server/repositories/settings.repository';
import { SquareRepository } from '$lib/server/repositories/square.repository';
import { UserRepository } from '$lib/server/repositories/user.repository';
import { VisitRepository } from '$lib/server/repositories/visit.repository';
import { WaiverRepository } from '$lib/server/repositories/waiver.repository';

export const REPOSITORIES = {
  bambuddyRepository: BambuddyRepository,
  billingCodeRepository: BillingCodeRepository,
  carBayRepository: CarBayRepository,
  classRepository: ClassRepository,
  dayPassRepository: DayPassRepository,
  discordRepository: DiscordRepository,
  emailTemplateRepository: EmailTemplateRepository,
  googleCalendarRepository: GoogleCalendarRepository,
  inventoryRepository: InventoryRepository,
  mailgunGateway: MailgunGateway,
  memberEmailRepository: MemberEmailRepository,
  memberNotificationGateway: MemberNotificationGateway,
  memberRepository: MemberRepository,
  memberSubscriptionRepository: MemberSubscriptionRepository,
  organizationMemberRepository: OrganizationMemberRepository,
  organizationRepository: OrganizationRepository,
  passRepository: PassRepository,
  paymentGateway: PaymentGateway,
  paymentRepository: PaymentRepository,
  printFilesRepository: PrintFilesRepository,
  printMaterialsRepository: PrintMaterialsRepository,
  printRequestCommentRepository: PrintRequestCommentRepository,
  printRequestRepository: PrintRequestRepository,
  settingsRepository: SettingsRepository,
  squareRepository: SquareRepository,
  userRepository: UserRepository,
  visitRepository: VisitRepository,
  waiverRepository: WaiverRepository,
};

type Registry = typeof REPOSITORIES;
export type ServiceRepositories = { [K in keyof Registry]: InstanceType<Registry[K]> };
type RepositoryKey = keyof ServiceRepositories;

/** Entries built from other entries, so they share the same instances as the service. */
const COMPOSED: { [K in RepositoryKey]?: (r: ServiceRepositories) => ServiceRepositories[K] } = {
  mailgunGateway: (r) => new MailgunGateway(r.emailTemplateRepository),
  memberNotificationGateway: (r) =>
    new MemberNotificationGateway(r.mailgunGateway, r.memberEmailRepository),
  paymentGateway: (r) =>
    new PaymentGateway(r.paymentRepository, r.squareRepository, r.settingsRepository),
};

function buildRepositories(overrides: Partial<ServiceRepositories>) {
  const built: Partial<ServiceRepositories> = { ...overrides };
  const repositories = {} as ServiceRepositories;

  function resolve<K extends RepositoryKey>(key: K): ServiceRepositories[K] {
    const compose = COMPOSED[key];
    const Repository = REPOSITORIES[key] as unknown as new () => ServiceRepositories[K];
    built[key] ??= compose ? compose(repositories) : new Repository();
    return built[key]!;
  }

  for (const key of Object.keys(REPOSITORIES) as RepositoryKey[]) {
    Object.defineProperty(repositories, key, { get: () => resolve(key), enumerable: true });
  }
  return { ...repositories };
}

// The registry above declares one field per repository on every service.
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging, @typescript-eslint/no-empty-object-type
export interface BaseService extends ServiceRepositories {}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class BaseService {
  constructor(repositories: Partial<ServiceRepositories> = {}) {
    Object.assign(this, buildRepositories(repositories));
  }
}
