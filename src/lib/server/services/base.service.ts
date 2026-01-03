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

  constructor(
    printFilesRepository?: PrintFilesRepository,
    printMaterialsRepository?: PrintMaterialsRepository,
    printRequestRepository?: PrintRequestRepository,
    printPaymentRepository?: PrintPaymentRepository,
    settingsRepository?: SettingsRepository,
    squareRepository?: SquareRepository,
  ) {
    this.printFilesRepository = printFilesRepository ?? new PrintFilesRepository();
    this.printMaterialsRepository = printMaterialsRepository ?? new PrintMaterialsRepository();
    this.printRequestRepository = printRequestRepository ?? new PrintRequestRepository();
    this.printPaymentRepository = printPaymentRepository ?? new PrintPaymentRepository();
    this.settingsRepository = settingsRepository ?? new SettingsRepository();
    this.squareRepository = squareRepository ?? new SquareRepository();
  }
}
