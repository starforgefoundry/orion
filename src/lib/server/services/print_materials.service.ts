import type {
  CreatePrintMaterialDto,
  UpdatePrintMaterialDto,
} from '$lib/api/dtos/print_materials.dto';
import { getPrintMaterials } from '$lib/api/endpoints/print_materials.remote';
import { BaseService } from '$lib/server/services/base.service';

class PrintMaterialsService extends BaseService {
  async getMaterials(available?: boolean) {
    return await this.printMaterialsRepository.get(available);
  }

  async createMaterial(data: CreatePrintMaterialDto) {
    return await this.printMaterialsRepository.create(data);
  }

  async updateMaterial(id: string, updates: Omit<UpdatePrintMaterialDto, 'id'>) {
    const material = await this.printMaterialsRepository.update(id, updates);
    await getPrintMaterials().refresh();
    return material;
  }
}

export const printMaterialsService = new PrintMaterialsService();
