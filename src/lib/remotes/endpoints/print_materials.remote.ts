import { command, form, query } from '$app/server';
import {
  createPrintMaterialDto,
  setMaterialSetupDto,
  updateAMSDto,
  updatePrintMaterialDto,
} from '$lib/remotes/dtos/print_materials.dto';
import { verifyAuth } from '$lib/remotes/utils';
import { printMaterialsService } from '$lib/server/services/print_materials.service';

export const getPrintMaterials = query(async () => {
  verifyAuth();
  return await printMaterialsService.getMaterials();
});

export const createPrintMaterial = command(createPrintMaterialDto, async (data) => {
  verifyAuth();
  return await printMaterialsService.createMaterial(data);
});

export const createPrintMaterialForm = form(createPrintMaterialDto, async (data) => {
  verifyAuth();
  return await printMaterialsService.createMaterial(data);
});

export const updatePrintMaterial = command(updatePrintMaterialDto, async (dto) => {
  verifyAuth();

  const { id, ...updates } = dto;

  const response = await printMaterialsService.updateMaterial(id, updates);
  await getPrintMaterials().refresh();

  return response;
});

export const setMaterialSetup = command(setMaterialSetupDto, async (dto) => {
  verifyAuth();

  const response = await printMaterialsService.setSetup(dto);
  await getPrintMaterials().refresh();

  return response;
});

export const getFilamentCatalog = query(async () => {
  verifyAuth();
  return await printMaterialsService.getFilamentCatalog();
});

export const updateAMSForPrinter = command(updateAMSDto, async (dto) => {
  verifyAuth();

  const { printer_id, ...updates } = dto;

  return await printMaterialsService.updateAMS(printer_id, updates);
});
