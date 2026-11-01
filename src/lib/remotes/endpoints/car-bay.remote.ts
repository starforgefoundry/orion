import { command, query } from '$app/server';
import {
  bookCarBayDto,
  cancelCarBayBookingDto,
  carBayBookingIdDto,
  carBayClosureIdDto,
  carBayRangeDto,
  customerEmailDto,
  sendCarBayOverrunInvoiceDto,
  staffBookCarBayDto,
  staffCancelCarBayBookingDto,
  staffCloseCarBayDto,
} from '$lib/remotes/dtos/car-bay.dto';
import { exposeUserErrors, verifyAuth } from '$lib/server/remote-utils';
import { carBayService } from '$lib/server/services/car-bay.service';
import * as v from 'valibot';

// ── Public ──

export const getCarBaySchedule = query(
  exposeUserErrors(async () => {
    return await carBayService.getPublicSchedule();
  }),
);

export const getCarBayMembership = query(
  customerEmailDto,
  exposeUserErrors(async (customerEmail) => {
    return await carBayService.isMember(customerEmail);
  }),
);

export const bookCarBay = command(
  bookCarBayDto,
  exposeUserErrors(async (dto) => {
    const result = await carBayService.book(dto);
    await getCarBaySchedule().refresh();
    return result;
  }),
);

export const getCarBayBookingByToken = query(
  v.string(),
  exposeUserErrors(async (token) => {
    return await carBayService.getBookingByToken(token);
  }),
);

export const cancelCarBayBooking = command(
  cancelCarBayBookingDto,
  exposeUserErrors(async (dto) => {
    const result = await carBayService.cancelByToken(dto.bookingToken);
    await getCarBayBookingByToken(dto.bookingToken).refresh();
    return result;
  }),
);

// ── Staff ──

export const getCarBayStaffSchedule = query(
  carBayRangeDto,
  exposeUserErrors(async (dto) => {
    verifyAuth();
    return await carBayService.getStaffSchedule(dto.from, dto.to);
  }),
);

export const getCarBayBookingDetail = query(
  v.string(),
  exposeUserErrors(async (id) => {
    verifyAuth();
    return await carBayService.getBookingDetail(id);
  }),
);

export const staffBookCarBay = command(
  staffBookCarBayDto,
  exposeUserErrors(async (dto) => {
    const user = verifyAuth();
    return await carBayService.staffBook(dto, user.email);
  }),
);

export const staffCancelCarBayBooking = command(
  staffCancelCarBayBookingDto,
  exposeUserErrors(async (dto) => {
    verifyAuth();
    const result = await carBayService.staffCancel(dto);
    await getCarBayBookingDetail(dto.bookingId).refresh();
    return result;
  }),
);

export const markCarBayNoShow = command(
  carBayBookingIdDto,
  exposeUserErrors(async (dto) => {
    verifyAuth();
    const result = await carBayService.markNoShow(dto.bookingId);
    await getCarBayBookingDetail(dto.bookingId).refresh();
    return result;
  }),
);

export const sendCarBayOverrunInvoice = command(
  sendCarBayOverrunInvoiceDto,
  exposeUserErrors(async (dto) => {
    verifyAuth();
    const result = await carBayService.sendOverrunInvoice(dto);
    await getCarBayBookingDetail(dto.bookingId).refresh();
    return result;
  }),
);

export const staffCloseCarBay = command(
  staffCloseCarBayDto,
  exposeUserErrors(async (dto) => {
    const user = verifyAuth();
    return await carBayService.staffClose(dto, user.email);
  }),
);

export const reopenCarBay = command(
  carBayClosureIdDto,
  exposeUserErrors(async (dto) => {
    verifyAuth();
    return await carBayService.reopen(dto.closureId);
  }),
);
