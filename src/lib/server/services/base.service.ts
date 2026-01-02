import { PrintFilesRepository } from '$lib/server/repositories/print_files.repository';
import { PrintMaterialsRepository } from '$lib/server/repositories/print_materials.repository';
import { PrintPaymentRepository } from '$lib/server/repositories/print_payment.repository';
import { PrintRequestRepository } from '$lib/server/repositories/print_request.repository';
import { SettingsRepository } from '$lib/server/repositories/settings.repository';
import { SquareRepository } from '$lib/server/repositories/square.repository';

export class BaseService {
  private _printFilesRepository?: PrintFilesRepository;
  private _printMaterialsRepository?: PrintMaterialsRepository;
  private _printRequestRepository?: PrintRequestRepository;
  private _printPaymentRepository?: PrintPaymentRepository;
  private _settingsRepository?: SettingsRepository;
  private _squareRepository?: SquareRepository;

  protected get printFilesRepository(): PrintFilesRepository {
    if (!this._printFilesRepository) {
      this._printFilesRepository = new PrintFilesRepository();
    }
    return this._printFilesRepository;
  }

  protected get printMaterialsRepository(): PrintMaterialsRepository {
    if (!this._printMaterialsRepository) {
      this._printMaterialsRepository = new PrintMaterialsRepository();
    }
    return this._printMaterialsRepository;
  }

  protected get printRequestRepository(): PrintRequestRepository {
    if (!this._printRequestRepository) {
      this._printRequestRepository = new PrintRequestRepository();
    }
    return this._printRequestRepository;
  }

  protected get printPaymentRepository(): PrintPaymentRepository {
    if (!this._printPaymentRepository) {
      this._printPaymentRepository = new PrintPaymentRepository();
    }
    return this._printPaymentRepository;
  }

  protected get settingsRepository(): SettingsRepository {
    if (!this._settingsRepository) {
      this._settingsRepository = new SettingsRepository();
    }
    return this._settingsRepository;
  }

  protected get squareRepository(): SquareRepository {
    if (!this._squareRepository) {
      this._squareRepository = new SquareRepository();
    }
    return this._squareRepository;
  }
}
