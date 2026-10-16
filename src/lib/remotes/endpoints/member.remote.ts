import { command, query } from '$app/server';
import {
  cancelMemberSubscriptionDto,
  memberVisitsDto,
  recentVisitsDto,
  searchMembersDto,
} from '$lib/remotes/dtos/member.dto';
import { verifyAuth } from '$lib/remotes/utils';
import { memberService } from '$lib/server/services/member.service';
import * as v from 'valibot';

export const searchMembers = query(searchMembersDto, async (dto) => {
  verifyAuth();
  return await memberService.listMembers(dto);
});

export const getMemberDetail = query(v.string(), async (id) => {
  verifyAuth();
  return await memberService.getMemberDetail(id);
});

export const getMemberVisits = query(memberVisitsDto, async (dto) => {
  verifyAuth();
  return await memberService.listMemberVisits(dto);
});

export const getRecentVisits = query(recentVisitsDto, async (dto) => {
  verifyAuth();
  return await memberService.listRecentVisits(dto);
});

export const cancelMemberSubscription = command(cancelMemberSubscriptionDto, async (dto) => {
  verifyAuth();
  await memberService.cancelSubscription(dto);
  await getMemberDetail(dto.memberId).refresh();
});

export const resendMemberOnboarding = command(v.string(), async (id) => {
  verifyAuth();
  await memberService.resendOnboarding(id);
  await getMemberDetail(id).refresh();
});

export const checkInMember = command(v.string(), async (id) => {
  verifyAuth();
  const visit = await memberService.checkIn(id);
  await getMemberDetail(id).refresh();
  return visit;
});
