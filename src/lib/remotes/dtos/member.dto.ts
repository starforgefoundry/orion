import { enumValues } from '$lib/utils/enum';
import {
  ACCESS_BASIS,
  MEMBER_SORT,
  ONBOARDING_FILTER,
  SORT_DIRECTION,
  WAIVER_FILTER,
} from '$lib/utils/member-enums';
import { MAX_PAGE_SIZE, pageFields } from '$lib/remotes/dtos/pagination.dto';
import * as v from 'valibot';

/** An empty list means the filter is off. */
const anyOf = <T extends Record<string, string>>(values: T) =>
  v.optional(v.array(v.picklist(enumValues(values))), []);

export const searchMembersDto = v.object({
  query: v.optional(v.string(), ''),
  access: anyOf(ACCESS_BASIS),
  waiver: anyOf(WAIVER_FILTER),
  onboarding: anyOf(ONBOARDING_FILTER),
  sort: v.optional(v.picklist(enumValues(MEMBER_SORT)), MEMBER_SORT.NAME),
  direction: v.optional(v.picklist(enumValues(SORT_DIRECTION)), SORT_DIRECTION.ASC),
  ...pageFields(),
});

export type MemberSearchFilter = v.InferOutput<typeof searchMembersDto>;

export const memberVisitsDto = v.object({
  memberId: v.string(),
  ...pageFields(),
});

export type MemberVisitsDto = v.InferOutput<typeof memberVisitsDto>;

export const recentVisitsDto = v.object({
  ...pageFields(),
});

export type RecentVisitsDto = v.InferOutput<typeof recentVisitsDto>;

export const cancelMemberSubscriptionDto = v.object({
  memberId: v.string(),
  subscriptionId: v.string(),
  refund: v.boolean(),
});

export type CancelMemberSubscriptionDto = v.InferOutput<typeof cancelMemberSubscriptionDto>;

export const sendMemberOnboardingsDto = v.pipe(
  v.array(v.string()),
  v.minLength(1),
  v.maxLength(MAX_PAGE_SIZE),
);
