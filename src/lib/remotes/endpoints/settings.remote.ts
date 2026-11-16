import { command, form, query } from '$app/server';
import {
  bambuddySettings,
  carBayAvailabilityDto,
  carBayPolicyDto,
  carBayRatesDto,
  classSettingsDto,
  memberSquareSettingsDto,
  printRequestSettings,
  printPricingSettingsDto,
  printRequestSquareSettings,
} from '$lib/remotes/dtos/settings.dto';
import { exposeUserErrors, staffOnly } from '$lib/server/remote-utils';
import { settingsService } from '$lib/server/services/settings.service';

export const getPublicPrintRequestForm = query(
  exposeUserErrors(() => settingsService.getPublicPrintRequestForm()),
);

export const getPrintRequestSettings = query(staffOnly(() => settingsService.get('printRequest')));

export const getBambuddySettings = query(staffOnly(() => settingsService.getBambuddySettings()));

export const getBambuddyStatus = query(staffOnly(() => settingsService.getBambuddyStatus()));

export const getPrintRequestSquareSettings = query(
  staffOnly(() => settingsService.get('printRequestSquare')),
);

export const printRequestSettingsForm = form(
  printRequestSettings,
  staffOnly(async (dto) => {
    const response = await settingsService.setPrintRequestSettings(dto);
    getPrintRequestSettings().refresh();

    return response;
  }),
);

export const printRequestSquareSettingsForm = form(
  printRequestSquareSettings,
  staffOnly(async (dto) => {
    const response = await settingsService.set('printRequestSquare', dto);
    getPrintRequestSquareSettings().refresh();

    return response;
  }),
);

export const bambuddySettingsForm = form(
  bambuddySettings,
  staffOnly(async (dto) => {
    const response = await settingsService.setBambuddySettings(dto);
    await getBambuddySettings().refresh();
    await getBambuddyStatus().refresh();

    return response;
  }),
);

export const getClassSettings = query(staffOnly(() => settingsService.get('classSettings')));

export const classSettingsForm = form(
  classSettingsDto,
  staffOnly(async (dto) => {
    const response = await settingsService.set('classSettings', dto);
    getClassSettings().refresh();

    return response;
  }),
);

export const getCarBayRates = query(exposeUserErrors(() => settingsService.get('carBayRates')));

export const setCarBayRates = command(
  carBayRatesDto,
  staffOnly(async (dto) => {
    const response = await settingsService.set('carBayRates', dto);
    getCarBayRates().refresh();

    return response;
  }),
);

export const getCarBayPolicy = query(exposeUserErrors(() => settingsService.get('carBayPolicy')));

export const setCarBayPolicy = command(
  carBayPolicyDto,
  staffOnly(async (dto) => {
    const response = await settingsService.set('carBayPolicy', dto);
    getCarBayPolicy().refresh();

    return response;
  }),
);

export const getCarBayAvailability = query(
  exposeUserErrors(() => settingsService.get('carBayAvailability')),
);

export const setCarBayAvailability = command(
  carBayAvailabilityDto,
  staffOnly(async (dto) => {
    const response = await settingsService.set('carBayAvailability', dto);
    getCarBayAvailability().refresh();

    return response;
  }),
);

export const getMemberSquareSettings = query(staffOnly(() => settingsService.get('memberSquare')));

export const memberSquareSettingsForm = form(
  memberSquareSettingsDto,
  staffOnly(async (dto) => {
    const response = await settingsService.set('memberSquare', dto);
    getMemberSquareSettings().refresh();

    return response;
  }),
);

export const getPrintPricing = query(staffOnly(() => settingsService.get('printPricing')));

export const printPricingSettingsForm = form(
  printPricingSettingsDto,
  staffOnly(async (dto) => {
    const response = await settingsService.set('printPricing', dto);
    getPrintPricing().refresh();

    return response;
  }),
);
