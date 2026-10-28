import { PASS_KIND } from '$lib/member_enums';
import type {
  CarBayPass,
  ClassPass,
  DayPassTicket,
  MembershipPass,
} from '$lib/server/repositories/pass.repository';
import { carBayBooking } from './car_bay';
import { classBooking, classCatalog, classInstance } from './class';
import { dayPass, member } from './member';

export function membershipPass(overrides: Partial<MembershipPass> = {}): MembershipPass {
  const holder = overrides.member ?? member();
  return {
    kind: PASS_KIND.MEMBERSHIP,
    passToken: holder.passToken,
    member: holder,
    ...overrides,
  };
}

export function dayPassTicket(overrides: Partial<DayPassTicket> = {}): DayPassTicket {
  const holder = overrides.member ?? member();
  const ticket = overrides.dayPass ?? dayPass({ memberId: holder.id });
  return {
    kind: PASS_KIND.DAY_PASS,
    passToken: ticket.passToken,
    member: holder,
    dayPass: ticket,
    ...overrides,
  };
}

export function classPass(overrides: Partial<ClassPass> = {}): ClassPass {
  const booking = overrides.booking ?? classBooking();
  return {
    kind: PASS_KIND.CLASS,
    passToken: booking.passToken,
    member: null,
    booking,
    instance: classInstance({ id: booking.instanceId }),
    catalog: classCatalog(),
    ...overrides,
  };
}

export function carBayPass(overrides: Partial<CarBayPass> = {}): CarBayPass {
  const booking = overrides.booking ?? carBayBooking();
  return {
    kind: PASS_KIND.CAR_BAY,
    passToken: booking.passToken,
    member: null,
    booking,
    ...overrides,
  };
}
