import { command, query } from '$app/server';
import {
  cancelMemberSubscriptionDto,
  memberVisitsDto,
  recentVisitsDto,
  searchMembersDto,
  sendMemberOnboardingsDto,
} from '$lib/remotes/dtos/member.dto';
import { staffOnly } from '$lib/server/remote-utils';
import { memberService } from '$lib/server/services/member.service';
import * as v from 'valibot';

export const searchMembers = query(
  searchMembersDto,
  staffOnly((dto) => memberService.listMembers(dto)),
);

export const getMemberDetail = query(
  v.string(),
  staffOnly((id) => memberService.getMemberDetail(id)),
);

export const getMemberVisits = query(
  memberVisitsDto,
  staffOnly((dto) => memberService.listMemberVisits(dto)),
);

export const getRecentVisits = query(
  recentVisitsDto,
  staffOnly((dto) => memberService.listRecentVisits(dto)),
);

export const cancelMemberSubscription = command(
  cancelMemberSubscriptionDto,
  staffOnly(async (dto) => {
    await memberService.cancelSubscription(dto);
    await getMemberDetail(dto.memberId).refresh();
  }),
);

export const resendMemberOnboarding = command(
  v.string(),
  staffOnly(async (id) => {
    await memberService.resendOnboarding(id);
    await getMemberDetail(id).refresh();
  }),
);

export const sendMemberOnboardings = command(
  sendMemberOnboardingsDto,
  staffOnly((ids) => memberService.sendOnboardings(ids)),
);

export const checkInMember = command(
  v.string(),
  staffOnly(async (id) => {
    const visit = await memberService.checkIn(id);
    await getMemberDetail(id).refresh();
    return visit;
  }),
);
