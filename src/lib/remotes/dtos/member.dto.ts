import * as v from 'valibot';

export const MEMBER_STATUS = {
  ALL: 'all',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const;

export type MemberStatus = (typeof MEMBER_STATUS)[keyof typeof MEMBER_STATUS];

export const MEMBER_PAGE_SIZE = 25;
export const VISIT_PAGE_SIZE = 25;

const page = v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 1);
const pageSize = (size: number) =>
  v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100)), size);

export const searchMembersDto = v.object({
  query: v.optional(v.string(), ''),
  status: v.optional(v.picklist(Object.values(MEMBER_STATUS)), MEMBER_STATUS.ALL),
  page,
  pageSize: pageSize(MEMBER_PAGE_SIZE),
});

export type SearchMembersDto = v.InferInput<typeof searchMembersDto>;
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
