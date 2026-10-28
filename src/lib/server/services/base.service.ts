import { BambuddyRepository } from '$lib/server/repositories/bambuddy.repository';
import { BillingCodeRepository } from '$lib/server/repositories/billing_code.repository';
import { CarBayRepository } from '$lib/server/repositories/car_bay.repository';
import { ClassRepository } from '$lib/server/repositories/class.repository';
import { DiscordRepository } from '$lib/server/repositories/discord.repository';
import { EmailTemplateRepository } from '$lib/server/repositories/email_template.repository';
import { GoogleCalendarRepository } from '$lib/server/repositories/google_calendar.repository';
import { InventoryRepository } from '$lib/server/repositories/inventory.repository';
import { MailgunRepository } from '$lib/server/repositories/mailgun.repository';
import { DayPassRepository } from '$lib/server/repositories/day_pass.repository';
import { MemberRepository } from '$lib/server/repositories/member.repository';
import { MemberEmailRepository } from '$lib/server/repositories/member_email.repository';
import { MemberNotificationRepository } from '$lib/server/repositories/member_notification.repository';
import { MemberSubscriptionRepository } from '$lib/server/repositories/member_subscription.repository';
import { OrganizationMemberRepository } from '$lib/server/repositories/organization_member.repository';
import { VisitRepository } from '$lib/server/repositories/visit.repository';
import { OrganizationRepository } from '$lib/server/repositories/organization.repository';
import { PassRepository } from '$lib/server/repositories/pass.repository';
import { PrintFilesRepository } from '$lib/server/repositories/print_files.repository';
import { PrintMaterialsRepository } from '$lib/server/repositories/print_materials.repository';
import { PaymentRepository } from '$lib/server/repositories/payment.repository';
import { PrintRequestRepository } from '$lib/server/repositories/print_request.repository';
import { PrintRequestCommentRepository } from '$lib/server/repositories/print_request_comment.repository';
import { SettingsRepository } from '$lib/server/repositories/settings.repository';
import { SquareRepository } from '$lib/server/repositories/square.repository';
import { WaiverRepository } from '$lib/server/repositories/waiver.repository';

export type ServiceRepositories = {
  bambuddyRepository: BambuddyRepository;
  billingCodeRepository: BillingCodeRepository;
  carBayRepository: CarBayRepository;
  classRepository: ClassRepository;
  dayPassRepository: DayPassRepository;
  discordRepository: DiscordRepository;
  emailTemplateRepository: EmailTemplateRepository;
  googleCalendarRepository: GoogleCalendarRepository;
  inventoryRepository: InventoryRepository;
  mailgunRepository: MailgunRepository;
  memberEmailRepository: MemberEmailRepository;
  memberNotificationRepository: MemberNotificationRepository;
  memberRepository: MemberRepository;
  memberSubscriptionRepository: MemberSubscriptionRepository;
  organizationMemberRepository: OrganizationMemberRepository;
  organizationRepository: OrganizationRepository;
  passRepository: PassRepository;
  paymentRepository: PaymentRepository;
  printFilesRepository: PrintFilesRepository;
  printMaterialsRepository: PrintMaterialsRepository;
  printRequestCommentRepository: PrintRequestCommentRepository;
  printRequestRepository: PrintRequestRepository;
  settingsRepository: SettingsRepository;
  squareRepository: SquareRepository;
  visitRepository: VisitRepository;
  waiverRepository: WaiverRepository;
};

export class BaseService {
  protected bambuddyRepository: BambuddyRepository;
  protected billingCodeRepository: BillingCodeRepository;
  protected carBayRepository: CarBayRepository;
  protected classRepository: ClassRepository;
  protected dayPassRepository: DayPassRepository;
  protected discordRepository: DiscordRepository;
  protected emailTemplateRepository: EmailTemplateRepository;
  protected googleCalendarRepository: GoogleCalendarRepository;
  protected inventoryRepository: InventoryRepository;
  protected mailgunRepository: MailgunRepository;
  protected memberEmailRepository: MemberEmailRepository;
  protected memberNotificationRepository: MemberNotificationRepository;
  protected memberRepository: MemberRepository;
  protected memberSubscriptionRepository: MemberSubscriptionRepository;
  protected organizationMemberRepository: OrganizationMemberRepository;
  protected organizationRepository: OrganizationRepository;
  protected passRepository: PassRepository;
  protected paymentRepository: PaymentRepository;
  protected printFilesRepository: PrintFilesRepository;
  protected printMaterialsRepository: PrintMaterialsRepository;
  protected printRequestCommentRepository: PrintRequestCommentRepository;
  protected printRequestRepository: PrintRequestRepository;
  protected settingsRepository: SettingsRepository;
  protected squareRepository: SquareRepository;
  protected visitRepository: VisitRepository;
  protected waiverRepository: WaiverRepository;

  constructor(repositories: Partial<ServiceRepositories> = {}) {
    this.bambuddyRepository = repositories.bambuddyRepository ?? new BambuddyRepository();
    this.billingCodeRepository = repositories.billingCodeRepository ?? new BillingCodeRepository();
    this.carBayRepository = repositories.carBayRepository ?? new CarBayRepository();
    this.classRepository = repositories.classRepository ?? new ClassRepository();
    this.dayPassRepository = repositories.dayPassRepository ?? new DayPassRepository();
    this.discordRepository = repositories.discordRepository ?? new DiscordRepository();
    this.emailTemplateRepository =
      repositories.emailTemplateRepository ?? new EmailTemplateRepository();
    this.googleCalendarRepository =
      repositories.googleCalendarRepository ?? new GoogleCalendarRepository();
    this.inventoryRepository = repositories.inventoryRepository ?? new InventoryRepository();
    this.mailgunRepository = repositories.mailgunRepository ?? new MailgunRepository();
    this.memberEmailRepository = repositories.memberEmailRepository ?? new MemberEmailRepository();
    this.memberNotificationRepository =
      repositories.memberNotificationRepository ?? new MemberNotificationRepository();
    this.memberRepository = repositories.memberRepository ?? new MemberRepository();
    this.memberSubscriptionRepository =
      repositories.memberSubscriptionRepository ?? new MemberSubscriptionRepository();
    this.organizationMemberRepository =
      repositories.organizationMemberRepository ?? new OrganizationMemberRepository();
    this.organizationRepository =
      repositories.organizationRepository ?? new OrganizationRepository();
    this.passRepository = repositories.passRepository ?? new PassRepository();
    this.paymentRepository = repositories.paymentRepository ?? new PaymentRepository();
    this.printFilesRepository = repositories.printFilesRepository ?? new PrintFilesRepository();
    this.printMaterialsRepository =
      repositories.printMaterialsRepository ?? new PrintMaterialsRepository();
    this.printRequestCommentRepository =
      repositories.printRequestCommentRepository ?? new PrintRequestCommentRepository();
    this.printRequestRepository =
      repositories.printRequestRepository ?? new PrintRequestRepository();
    this.settingsRepository = repositories.settingsRepository ?? new SettingsRepository();
    this.squareRepository = repositories.squareRepository ?? new SquareRepository();
    this.visitRepository = repositories.visitRepository ?? new VisitRepository();
    this.waiverRepository = repositories.waiverRepository ?? new WaiverRepository();
  }
}
