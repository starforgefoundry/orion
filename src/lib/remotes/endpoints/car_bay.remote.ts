import { command, query } from '$app/server';
import {
  bookCarBayDto,
  cancelCarBayBookingDto,
  carBayBookingIdDto,
  carBayRangeDto,
  customerEmailDto,
  sendCarBayOverrunInvoiceDto,
  staffBookCarBayDto,
  staffCancelCarBayBookingDto,
} from '$lib/remotes/dtos/car_bay.dto';
import { verifyAuth } from '$lib/remotes/utils';
import { carBayService } from '$lib/server/services/car_bay.service';
import { CarBayRuleError } from '$lib/utils/car_bay';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';

const BAD_REQUEST = 400;

/** Unexpected errors reach the browser as a generic message, so rule violations are sent as 400s. */
async function withRuleErrors<T>(action: () => Promise<T>) {
  try {
    return await action();
  } catch (cause) {
    if (cause instanceof CarBayRuleError) error(BAD_REQUEST, cause.message);
    throw cause;
  }
}

// ── Public ──

export const getCarBaySchedule = query(async () => {
  return await carBayService.getPublicSchedule();
});

export const getCarBayMembership = query(customerEmailDto, async (customerEmail) => {
  return await carBayService.isMember(customerEmail);
});

export const bookCarBay = command(bookCarBayDto, async (dto) => {
  const result = await withRuleErrors(() => carBayService.book(dto));
  await getCarBaySchedule().refresh();
  return result;
});

export const getCarBayBookingByToken = query(v.string(), async (token) => {
  return await carBayService.getBookingByToken(token);
});

export const cancelCarBayBooking = command(cancelCarBayBookingDto, async (dto) => {
  const result = await withRuleErrors(() => carBayService.cancelByToken(dto.bookingToken));
  await getCarBayBookingByToken(dto.bookingToken).refresh();
  return result;
});

// ── Staff ──

export const getCarBayStaffSchedule = query(carBayRangeDto, async (dto) => {
  verifyAuth();
  return await carBayService.getStaffSchedule(dto.from, dto.to);
});

export const getCarBayBookingDetail = query(v.string(), async (id) => {
  verifyAuth();
  return await carBayService.getBookingDetail(id);
});

export const staffBookCarBay = command(staffBookCarBayDto, async (dto) => {
  const user = verifyAuth();
  return await withRuleErrors(() => carBayService.staffBook(dto, user.email));
});

export const staffCancelCarBayBooking = command(staffCancelCarBayBookingDto, async (dto) => {
  verifyAuth();
  const result = await withRuleErrors(() => carBayService.staffCancel(dto));
  await getCarBayBookingDetail(dto.bookingId).refresh();
  return result;
});

export const markCarBayNoShow = command(carBayBookingIdDto, async (dto) => {
  verifyAuth();
  const result = await withRuleErrors(() => carBayService.markNoShow(dto.bookingId));
  await getCarBayBookingDetail(dto.bookingId).refresh();
  return result;
});

export const sendCarBayOverrunInvoice = command(sendCarBayOverrunInvoiceDto, async (dto) => {
  verifyAuth();
  const result = await withRuleErrors(() => carBayService.sendOverrunInvoice(dto));
  await getCarBayBookingDetail(dto.bookingId).refresh();
  return result;
});
