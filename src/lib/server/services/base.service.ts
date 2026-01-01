import { PrintCustomerRepository } from '$lib/server/repositories/print_customer.repostiory';
import { PrintFilesRepository } from '$lib/server/repositories/print_files.repository';
import { PrintMaterialsRepository } from '$lib/server/repositories/print_materials.repository';
import { PrintRequestRepository } from '$lib/server/repositories/print_request.repository';

export class BaseService {
  private _printCustomerRepository?: PrintCustomerRepository;
  private _printFilesRepository?: PrintFilesRepository;
  private _printMaterialsRepository?: PrintMaterialsRepository;
  private _printRequestRepository?: PrintRequestRepository;

  protected get printCustomerRepository(): PrintCustomerRepository {
    if (!this._printCustomerRepository) {
      this._printCustomerRepository = new PrintCustomerRepository();
    }
    return this._printCustomerRepository;
  }

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
}
