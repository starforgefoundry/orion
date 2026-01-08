import { BillingCodeRepository } from '$lib/server/repositories/billing_code.repository';
import { DiscordRepository } from '$lib/server/repositories/discord.repository';
import { MailgunRepository } from '$lib/server/repositories/mailgun.repository';
import { OrganizationRepository } from '$lib/server/repositories/organization.repository';
import { PrintFilesRepository } from '$lib/server/repositories/print_files.repository';
import { PrintMaterialsRepository } from '$lib/server/repositories/print_materials.repository';
import { PaymentRepository } from '$lib/server/repositories/print_payment.repository';
import { PrintRequestRepository } from '$lib/server/repositories/print_request.repository';
import { SettingsRepository } from '$lib/server/repositories/settings.repository';
import { SquareRepository } from '$lib/server/repositories/square.repository';

export class BaseService {
  protected printFilesRepository: PrintFilesRepository;
  protected printMaterialsRepository: PrintMaterialsRepository;
  protected printRequestRepository: PrintRequestRepository;
  protected paymentRepository: PaymentRepository;
  protected settingsRepository: SettingsRepository;
  protected squareRepository: SquareRepository;
  protected mailgunRepository: MailgunRepository;
  protected discordRepository: DiscordRepository;
  protected organizationRepository: OrganizationRepository;
  protected billingCodeRepository: BillingCodeRepository;

  constructor(
    printFilesRepository?: PrintFilesRepository,
    printMaterialsRepository?: PrintMaterialsRepository,
    printRequestRepository?: PrintRequestRepository,
    paymentRepository?: PaymentRepository,
    settingsRepository?: SettingsRepository,
    squareRepository?: SquareRepository,
    mailgunRepository?: MailgunRepository,
    discordRepository?: DiscordRepository,
    organizationRepository?: OrganizationRepository,
    billingCodeRepository?: BillingCodeRepository,
  ) {
    this.printFilesRepository = printFilesRepository ?? new PrintFilesRepository();
    this.printMaterialsRepository = printMaterialsRepository ?? new PrintMaterialsRepository();
    this.printRequestRepository = printRequestRepository ?? new PrintRequestRepository();
    this.paymentRepository = paymentRepository ?? new PaymentRepository();
    this.settingsRepository = settingsRepository ?? new SettingsRepository();
    this.squareRepository = squareRepository ?? new SquareRepository();
    this.mailgunRepository = mailgunRepository ?? new MailgunRepository();
    this.discordRepository = discordRepository ?? new DiscordRepository();
    this.organizationRepository = organizationRepository ?? new OrganizationRepository();
    this.billingCodeRepository = billingCodeRepository ?? new BillingCodeRepository();
  }
}
