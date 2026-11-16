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
import { exposeUserErrors, staffOnly, verifyAuth } from '$lib/server/remote-utils';
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
  staffOnly((dto) => carBayService.getStaffSchedule(dto.from, dto.to)),
);

export const getCarBayBookingDetail = query(
  v.string(),
  staffOnly((id) => carBayService.getBookingDetail(id)),
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
  staffOnly(async (dto) => {
    const result = await carBayService.staffCancel(dto);
    await getCarBayBookingDetail(dto.bookingId).refresh();
    return result;
  }),
);

export const markCarBayNoShow = command(
  carBayBookingIdDto,
  staffOnly(async (dto) => {
    const result = await carBayService.markNoShow(dto.bookingId);
    await getCarBayBookingDetail(dto.bookingId).refresh();
    return result;
  }),
);

export const sendCarBayOverrunInvoice = command(
  sendCarBayOverrunInvoiceDto,
  staffOnly(async (dto) => {
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
  staffOnly((dto) => carBayService.reopen(dto.closureId)),
);
