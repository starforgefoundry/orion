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
import { ResendRepository } from '$lib/server/repositories/resend.repository';
import { ServiceRepository } from '$lib/server/repositories/service.repository';
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
  memberEmailRepository: MemberEmailRepository,
  memberRepository: MemberRepository,
  memberSubscriptionRepository: MemberSubscriptionRepository,
  organizationMemberRepository: OrganizationMemberRepository,
  organizationRepository: OrganizationRepository,
  passRepository: PassRepository,
  paymentRepository: PaymentRepository,
  printFilesRepository: PrintFilesRepository,
  printMaterialsRepository: PrintMaterialsRepository,
  printRequestCommentRepository: PrintRequestCommentRepository,
  printRequestRepository: PrintRequestRepository,
  resendRepository: ResendRepository,
  serviceRepository: ServiceRepository,
  settingsRepository: SettingsRepository,
  squareRepository: SquareRepository,
  userRepository: UserRepository,
  visitRepository: VisitRepository,
  waiverRepository: WaiverRepository,
};

type Registry = typeof REPOSITORIES;
export type ServiceRepositories = { [K in keyof Registry]: InstanceType<Registry[K]> };
type RepositoryKey = keyof ServiceRepositories;

function buildRepositories(overrides: Partial<ServiceRepositories>) {
  const entries = (Object.keys(REPOSITORIES) as RepositoryKey[]).map((key) => {
    const Repository = REPOSITORIES[key] as new () => ServiceRepositories[RepositoryKey];
    return [key, overrides[key] ?? new Repository()];
  });
  return Object.fromEntries(entries) as ServiceRepositories;
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
