import { command, query } from '$app/server';
import {
  createPrintMaterialDto,
  setMaterialSetupDto,
  updateAMSDto,
  updatePrintMaterialDto,
} from '$lib/remotes/dtos/print-materials.dto';
import { staffOnly } from '$lib/server/remote-utils';
import { printMaterialsService } from '$lib/server/services/print-materials.service';

export const getPrintMaterials = query(staffOnly(() => printMaterialsService.getMaterials()));

export const createPrintMaterial = command(
  createPrintMaterialDto,
  staffOnly(async (data) => {
    const material = await printMaterialsService.createMaterial(data);
    await getPrintMaterials().refresh();

    return material;
  }),
);

export const updatePrintMaterial = command(
  updatePrintMaterialDto,
  staffOnly(async (dto) => {
    const { id, ...updates } = dto;

    const response = await printMaterialsService.updateMaterial(id, updates);
    await getPrintMaterials().refresh();

    return response;
  }),
);

export const setMaterialSetup = command(
  setMaterialSetupDto,
  staffOnly(async (dto) => {
    const response = await printMaterialsService.setSetup(dto);
    await getPrintMaterials().refresh();

    return response;
  }),
);

export const getFilamentCatalog = query(
  staffOnly(() => printMaterialsService.getFilamentCatalog()),
);

export const updateAMSForPrinter = command(
  updateAMSDto,
  staffOnly(async (dto) => {
    const { printer_id, ...updates } = dto;

    return await printMaterialsService.updateAMS(printer_id, updates);
  }),
);
