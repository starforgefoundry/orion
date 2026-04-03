import { form, query } from '$app/server';
import {
  classSettingsDto,
  printRequestSettings,
  printRequestSquareSettings,
} from '$lib/remotes/dtos/settings.dto';
import { verifyAuth } from '$lib/remotes/utils';
import { settingsService } from '$lib/server/services/settings.service';

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
