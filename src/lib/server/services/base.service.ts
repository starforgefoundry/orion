import { BambuddyRepository } from '$lib/server/repositories/bambuddy.repository';
import { BillingCodeRepository } from '$lib/server/repositories/billing_code.repository';
import { DiscordRepository } from '$lib/server/repositories/discord.repository';
import { InventoryRepository } from '$lib/server/repositories/inventory.repository';
import { MailgunRepository } from '$lib/server/repositories/mailgun.repository';
import { OrganizationRepository } from '$lib/server/repositories/organization.repository';
import { PrintFilesRepository } from '$lib/server/repositories/print_files.repository';
import { PrintMaterialsRepository } from '$lib/server/repositories/print_materials.repository';
import { PaymentRepository } from '$lib/server/repositories/print_payment.repository';
import { PrintRequestRepository } from '$lib/server/repositories/print_request.repository';
import { PrintRequestCommentRepository } from '$lib/server/repositories/print_request_comment.repository';
import { SettingsRepository } from '$lib/server/repositories/settings.repository';
import { SquareRepository } from '$lib/server/repositories/square.repository';
import { WaiverRepository } from '$lib/server/repositories/waiver.repository';

export class BaseService {
  protected printFilesRepository: PrintFilesRepository;
  protected printMaterialsRepository: PrintMaterialsRepository;
  protected printRequestRepository: PrintRequestRepository;
  protected printRequestCommentRepository: PrintRequestCommentRepository;
  protected paymentRepository: PaymentRepository;
  protected settingsRepository: SettingsRepository;
  protected squareRepository: SquareRepository;
  protected mailgunRepository: MailgunRepository;
  protected discordRepository: DiscordRepository;
  protected organizationRepository: OrganizationRepository;
  protected billingCodeRepository: BillingCodeRepository;
  protected inventoryRepository: InventoryRepository;
  protected bambuddyRepository: BambuddyRepository;
  protected waiverRepository: WaiverRepository;

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
    inventoryRepository?: InventoryRepository,
    bambuddyRepository?: BambuddyRepository,
    waiverRepository?: WaiverRepository,
    printRequestCommentRepository?: PrintRequestCommentRepository,
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
    this.inventoryRepository = inventoryRepository ?? new InventoryRepository();
    this.bambuddyRepository = bambuddyRepository ?? new BambuddyRepository();
    this.waiverRepository = waiverRepository ?? new WaiverRepository();
    this.printRequestCommentRepository =
      printRequestCommentRepository ?? new PrintRequestCommentRepository();
  }
}
