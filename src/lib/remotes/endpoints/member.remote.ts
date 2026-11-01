import { command, query } from '$app/server';
import {
  cancelMemberSubscriptionDto,
  memberVisitsDto,
  recentVisitsDto,
  searchMembersDto,
  sendMemberOnboardingsDto,
} from '$lib/remotes/dtos/member.dto';
import { exposeUserErrors, verifyAuth } from '$lib/server/remote-utils';
import { memberService } from '$lib/server/services/member.service';
import * as v from 'valibot';

export const searchMembers = query(
  searchMembersDto,
  exposeUserErrors(async (dto) => {
    verifyAuth();
    return await memberService.listMembers(dto);
  }),
);

export const getMemberDetail = query(
  v.string(),
  exposeUserErrors(async (id) => {
    verifyAuth();
    return await memberService.getMemberDetail(id);
  }),
);

export const getMemberVisits = query(
  memberVisitsDto,
  exposeUserErrors(async (dto) => {
    verifyAuth();
    return await memberService.listMemberVisits(dto);
  }),
);

export const getRecentVisits = query(
  recentVisitsDto,
  exposeUserErrors(async (dto) => {
    verifyAuth();
    return await memberService.listRecentVisits(dto);
  }),
);

export const cancelMemberSubscription = command(
  cancelMemberSubscriptionDto,
  exposeUserErrors(async (dto) => {
    verifyAuth();
    await memberService.cancelSubscription(dto);
    await getMemberDetail(dto.memberId).refresh();
  }),
);

export const resendMemberOnboarding = command(
  v.string(),
  exposeUserErrors(async (id) => {
    verifyAuth();
    await memberService.resendOnboarding(id);
    await getMemberDetail(id).refresh();
  }),
);

export const sendMemberOnboardings = command(
  sendMemberOnboardingsDto,
  exposeUserErrors(async (ids) => {
    verifyAuth();
    return await memberService.sendOnboardings(ids);
  }),
);

export const checkInMember = command(
  v.string(),
  exposeUserErrors(async (id) => {
    verifyAuth();
    const visit = await memberService.checkIn(id);
    await getMemberDetail(id).refresh();
    return visit;
  }),
);
