import { command, form, query } from '$app/server';
import { createPrintMaterialDto, updatePrintMaterialDto } from '$lib/api/dtos/print_materials.dto';
import { verifyAuth } from '$lib/api/utils';
import { printMaterialsRepository } from '$lib/server/repositories/print_materials.repository';

export const getPrintMaterials = query(async () => {
  verifyAuth();
  return await printMaterialsRepository.get();
});

// Used for public material listing on upload form
export const getAvailableMaterials = query(async () => {
  return await printMaterialsRepository.get(true);
});

export const createPrintMaterial = command(createPrintMaterialDto, async (data) => {
  verifyAuth();
  return await printMaterialsRepository.create(data);
});

export const createPrintMaterialForm = form(createPrintMaterialDto, async (data) => {
  verifyAuth();
  return await printMaterialsRepository.create(data);
});

export const updatePrintMaterial = command(updatePrintMaterialDto, async (dto) => {
  verifyAuth();

  const { id, ...updates } = dto;

  const material = await printMaterialsRepository.update(id, updates);
  await getPrintMaterials().refresh();

  return material;
});
