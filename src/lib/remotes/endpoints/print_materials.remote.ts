import { command, form, query } from '$app/server';
import {
  createPrintMaterialDto,
  updatePrintMaterialDto,
} from '$lib/remotes/dtos/print_materials.dto';
import { verifyAuth } from '$lib/remotes/utils';
import { printMaterialsService } from '$lib/server/services/print_materials.service';

export const getPrintMaterials = query(async () => {
  verifyAuth();
  return await printMaterialsService.getMaterials();
});

// Used for public material listing on upload form
export const getAvailableMaterials = query(async () => {
  return await printMaterialsService.getMaterials(true);
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

  return await printMaterialsService.updateMaterial(id, updates);
});
