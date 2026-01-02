import { form, query } from '$app/server';
import { printRequestSettings, printRequestSquareSettings } from '$lib/remotes/dtos/settings.dto';
import { verifyAuth } from '$lib/remotes/utils';
import { settingsService } from '$lib/server/services/settings.service';

export const getPrintRequestSettings = query(() => settingsService.getPrintRequestSettings());

export const getPrintRequestSquareSettings = query(() => {
  verifyAuth();
  return settingsService.getPrintRequestSquareSettings();
});

export const printRequestSettingsForm = form(printRequestSettings, async (dto) => {
  verifyAuth();
  return await settingsService.setPrintRequestSettings(dto);
});

export const printRequestSquareSettingsForm = form(printRequestSquareSettings, async (dto) => {
  verifyAuth();
  return await settingsService.setPrintRequestSquareSettings(dto);
});
