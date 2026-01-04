import type {
  CreatePrintMaterialDto,
  UpdatePrintMaterialDto,
} from '$lib/remotes/dtos/print_materials.dto';
import { BaseService } from '$lib/server/services/base.service';

export class PrintMaterialsService extends BaseService {
  async getMaterials(available?: boolean) {
    return await this.printMaterialsRepository.get(available);
  }

  async createMaterial(data: CreatePrintMaterialDto) {
    return await this.printMaterialsRepository.create(data);
  }

  async updateMaterial(id: string, updates: Omit<UpdatePrintMaterialDto, 'id'>) {
    const material = await this.printMaterialsRepository.update(id, updates);
    return material;
  }
}

export const printMaterialsService = new PrintMaterialsService();
