import { command, form, query } from '$app/server';
import {
  bambuLoginDto,
  classSettingsDto,
  printRequestSettings,
  printRequestSquareSettings,
} from '$lib/remotes/dtos/settings.dto';
import { verifyAuth } from '$lib/remotes/utils';
import { settingsService } from '$lib/server/services/settings.service';
import { error } from '@sveltejs/kit';

export const getPrintRequestSettings = query(() => settingsService.getPrintRequestSettings());

export const getPrintRequestSquareSettings = query(() => {
  verifyAuth();
  return settingsService.getPrintRequestSquareSettings();
});

export const printRequestSettingsForm = form(printRequestSettings, async (dto) => {
  verifyAuth();
  const response = await settingsService.setPrintRequestSettings(dto);
  getPrintRequestSettings().refresh();

  return response;
});

export const printRequestSquareSettingsForm = form(printRequestSquareSettings, async (dto) => {
  verifyAuth();
  const response = await settingsService.setPrintRequestSquareSettings(dto);
  getPrintRequestSquareSettings().refresh();

  return response;
});

export const refreshBambuCredentials = command(bambuLoginDto, async (dto) => {
  verifyAuth();

  try {
    const result = await settingsService.refreshBambuCredentials(dto);
    getPrintRequestSettings().refresh();

    return result;
  } catch (cause) {
    // SvelteKit replaces plain errors with "Internal Error"; the operator needs
    // to read what Bambu Lab actually said, such as a rejected code.
    error(400, cause instanceof Error ? cause.message : 'Bambu Lab sign in failed');
  }
});

export const getClassSettings = query(() => {
  verifyAuth();
  return settingsService.getClassSettings();
});

export const classSettingsForm = form(classSettingsDto, async (dto) => {
  verifyAuth();
  const response = await settingsService.setClassSettings(dto);
  getClassSettings().refresh();

  return response;
});
