import { DiscordRepository } from '$lib/server/repositories/discord.repository';
import { MailgunRepository } from '$lib/server/repositories/mailgun.repository';
import { PrintFilesRepository } from '$lib/server/repositories/print_files.repository';
import { PrintMaterialsRepository } from '$lib/server/repositories/print_materials.repository';
import { PrintPaymentRepository } from '$lib/server/repositories/print_payment.repository';
import { PrintRequestRepository } from '$lib/server/repositories/print_request.repository';
import { SettingsRepository } from '$lib/server/repositories/settings.repository';
import { SquareRepository } from '$lib/server/repositories/square.repository';

export class BaseService {
  protected printFilesRepository: PrintFilesRepository;
  protected printMaterialsRepository: PrintMaterialsRepository;
  protected printRequestRepository: PrintRequestRepository;
  protected printPaymentRepository: PrintPaymentRepository;
  protected settingsRepository: SettingsRepository;
  protected squareRepository: SquareRepository;
  protected mailgunRepository: MailgunRepository;
  protected discordRepository: DiscordRepository;

  constructor(
    printFilesRepository?: PrintFilesRepository,
    printMaterialsRepository?: PrintMaterialsRepository,
    printRequestRepository?: PrintRequestRepository,
    printPaymentRepository?: PrintPaymentRepository,
    settingsRepository?: SettingsRepository,
    squareRepository?: SquareRepository,
    mailgunRepository?: MailgunRepository,
    discordRepository?: DiscordRepository,
  ) {
    this.printFilesRepository = printFilesRepository ?? new PrintFilesRepository();
    this.printMaterialsRepository = printMaterialsRepository ?? new PrintMaterialsRepository();
    this.printRequestRepository = printRequestRepository ?? new PrintRequestRepository();
    this.printPaymentRepository = printPaymentRepository ?? new PrintPaymentRepository();
    this.settingsRepository = settingsRepository ?? new SettingsRepository();
    this.squareRepository = squareRepository ?? new SquareRepository();
    this.mailgunRepository = mailgunRepository ?? new MailgunRepository();
    this.discordRepository = discordRepository ?? new DiscordRepository();
  }
}
