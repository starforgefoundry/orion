import { command, form, getRequestEvent, query } from '$app/server';
import { HTTP_STATUS } from '$lib/http';
import { KIOSK_DEVICE_COOKIE, kioskCheckInDto, kioskWaiverDto } from '$lib/remotes/dtos/kiosk.dto';
import { exposeUserErrors, verifyAuth } from '$lib/remotes/utils';
import { kioskService } from '$lib/server/services/kiosk.service';
import { error } from '@sveltejs/kit';

function isPairedDevice() {
  const { cookies } = getRequestEvent();
  return kioskService.isPairedDevice(cookies.get(KIOSK_DEVICE_COOKIE));
}

async function verifyKiosk() {
  if (!(await isPairedDevice())) error(HTTP_STATUS.UNAUTHORIZED, 'This kiosk is not paired');
}

export const getKioskStatus = query(
  exposeUserErrors(async () => ({ paired: await isPairedDevice() })),
);

export const checkInKiosk = command(
  kioskCheckInDto,
  exposeUserErrors(async (scanned) => {
    await verifyKiosk();
    return await kioskService.checkIn(scanned);
  }),
);

export const kioskWaiverForm = form(
  kioskWaiverDto,
  exposeUserErrors(async (dto) => {
    await verifyKiosk();
    return await kioskService.submitWaiver(dto);
  }),
);

export const getKioskPairing = query(
  exposeUserErrors(() => {
    verifyAuth();
    return kioskService.getPairing();
  }),
);

export const rotateKioskToken = command(
  exposeUserErrors(async () => {
    verifyAuth();
    const pairing = await kioskService.rotateDeviceToken();
    getKioskPairing().set(pairing);
    return pairing;
  }),
);
