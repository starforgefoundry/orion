import { command, form, getRequestEvent, query } from '$app/server';
import { KIOSK_DEVICE_COOKIE, kioskCheckInDto, kioskWaiverDto } from '$lib/remotes/dtos/kiosk.dto';
import { verifyAuth } from '$lib/remotes/utils';
import { kioskService } from '$lib/server/services/kiosk.service';
import { error } from '@sveltejs/kit';

const UNAUTHORIZED = 401;

function isPairedDevice() {
  const { cookies } = getRequestEvent();
  return kioskService.isPairedDevice(cookies.get(KIOSK_DEVICE_COOKIE));
}

async function verifyKiosk() {
  if (!(await isPairedDevice())) error(UNAUTHORIZED, 'This kiosk is not paired');
}

export const getKioskStatus = query(async () => ({ paired: await isPairedDevice() }));

export const checkInKiosk = command(kioskCheckInDto, async (scanned) => {
  await verifyKiosk();
  return await kioskService.checkIn(scanned);
});

export const kioskWaiverForm = form(kioskWaiverDto, async (dto) => {
  await verifyKiosk();
  return await kioskService.submitWaiver(dto);
});

export const getKioskPairing = query(() => {
  verifyAuth();
  return kioskService.getPairing();
});

export const rotateKioskToken = command(async () => {
  verifyAuth();
  const pairing = await kioskService.rotateDeviceToken();
  getKioskPairing().set(pairing);
  return pairing;
});
