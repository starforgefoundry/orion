import { command, form, query } from '$app/server';
import {
  bambuddySettings,
  carBayPolicyDto,
  carBayRatesDto,
  classSettingsDto,
  printRequestSettings,
  printRequestSquareSettings,
} from '$lib/remotes/dtos/settings.dto';
import { verifyAuth } from '$lib/remotes/utils';
import { settingsService } from '$lib/server/services/settings.service';

export const getPublicPrintRequestForm = query(() => settingsService.getPublicPrintRequestForm());

export const getPrintRequestSettings = query(() => {
  verifyAuth();
  return settingsService.getPrintRequestSettings();
});

export const getBambuddySettings = query(() => {
  verifyAuth();
  return settingsService.getBambuddySettings();
});

export const getBambuddyStatus = query(() => {
  verifyAuth();
  return settingsService.getBambuddyStatus();
});

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

export const bambuddySettingsForm = form(bambuddySettings, async (dto) => {
  verifyAuth();
  const response = await settingsService.setBambuddySettings(dto);
  await getBambuddySettings().refresh();
  await getBambuddyStatus().refresh();

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

export const getCarBayRates = query(() => settingsService.getCarBayRates());

export const setCarBayRates = command(carBayRatesDto, async (dto) => {
  verifyAuth();
  const response = await settingsService.setCarBayRates(dto);
  getCarBayRates().refresh();

  return response;
});

export const getCarBayPolicy = query(() => settingsService.getCarBayPolicy());

export const setCarBayPolicy = command(carBayPolicyDto, async (dto) => {
  verifyAuth();
  const response = await settingsService.setCarBayPolicy(dto);
  getCarBayPolicy().refresh();

  return response;
});
