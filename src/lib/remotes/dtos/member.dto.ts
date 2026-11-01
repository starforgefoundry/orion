import {
  ACCESS_BASIS,
  enumValues,
  MEMBER_SORT,
  ONBOARDING_FILTER,
  SORT_DIRECTION,
  WAIVER_FILTER,
} from '$lib/utils/member-enums';
import * as v from 'valibot';

export const MEMBER_PAGE_SIZE = 25;
export const VISIT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

const page = v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 1);
const pageSize = (size: number) =>
  v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(MAX_PAGE_SIZE)), size);
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
  page,
  pageSize: pageSize(MEMBER_PAGE_SIZE),
});

export type MemberSearchFilter = v.InferOutput<typeof searchMembersDto>;

export const memberVisitsDto = v.object({
  memberId: v.string(),
  page,
  pageSize: pageSize(VISIT_PAGE_SIZE),
});

export type MemberVisitsDto = v.InferOutput<typeof memberVisitsDto>;

export const recentVisitsDto = v.object({
  page,
  pageSize: pageSize(VISIT_PAGE_SIZE),
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
