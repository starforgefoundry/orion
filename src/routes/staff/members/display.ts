import type { Tone } from '$lib/frontend/components/StatusBadge.svelte';
import type { OnboardingFilter, WaiverFilter } from '$lib/remotes/dtos/member.dto';
import type { MemberEmail, MemberSubscription, Visit } from '$lib/server/db/schema';
import { DateTime } from 'luxon';

type Display = { label: string; tone: Tone };

export const ACCESS_BASIS_DISPLAY: Record<Visit['accessBasis'], Display> = {
  subscription: { label: 'Subscription', tone: 'success' },
  organization: { label: 'Organization', tone: 'info' },
  day_pass: { label: 'Day Pass', tone: 'primary' },
  none: { label: 'No Access', tone: 'neutral' },
};

export const VISIT_OUTCOME_DISPLAY: Record<Visit['outcome'], Display> = {
  admitted: { label: 'Admitted', tone: 'success' },
  denied_no_waiver: { label: 'No Waiver', tone: 'warning' },
  denied_no_access: { label: 'No Access', tone: 'danger' },
};

export const VISIT_SOURCE_LABEL: Record<Visit['source'], string> = {
  kiosk: 'Kiosk',
  staff: 'Staff',
};

export const SUBSCRIPTION_STATUS_DISPLAY: Record<MemberSubscription['status'], Display> = {
  pending: { label: 'Pending', tone: 'warning' },
  active: { label: 'Active', tone: 'success' },
  paused: { label: 'Paused', tone: 'warning' },
  canceled: { label: 'Canceled', tone: 'danger' },
  deactivated: { label: 'Deactivated', tone: 'neutral' },
};

export const EMAIL_TYPE_LABEL: Record<MemberEmail['type'], string> = {
  onboarding: 'Onboarding',
  waiver_request: 'Waiver Request',
};

export const EMAIL_TRIGGER_LABEL: Record<MemberEmail['trigger'], string> = {
  subscription: 'Subscription',
  organization: 'Organization',
  day_pass: 'Day Pass',
  manual: 'Staff',
  self_service: 'Member Request',
};

export const WAIVER_DISPLAY = {
  signed: { label: 'Signed', tone: 'success' },
  missing: { label: 'Missing', tone: 'warning' },
} as const satisfies Record<string, Display>;

export const WAIVER_FILTER_LABEL: Record<WaiverFilter, string> = {
  signed: WAIVER_DISPLAY.signed.label,
  missing: WAIVER_DISPLAY.missing.label,
};

export const ONBOARDING_FILTER_LABEL: Record<OnboardingFilter, string> = {
  sent: 'Sent',
  not_sent: 'Not Sent',
};

export function waiverDisplay(hasWaiver: boolean) {
  return hasWaiver ? WAIVER_DISPLAY.signed : WAIVER_DISPLAY.missing;
}

export function memberHref(memberId: string) {
  return `/staff/members/${memberId}`;
}

export function formatDate(date: DateTime | null | undefined) {
  return date ? date.toLocaleString(DateTime.DATE_MED) : '—';
}

export function formatDateTime(date: DateTime) {
  return date.toLocaleString(DateTime.DATETIME_MED);
}

/** For YYYY-MM-DD columns, which have no time zone. */
export function formatIsoDate(date: string | null | undefined) {
  return date ? DateTime.fromISO(date).toLocaleString(DateTime.DATE_MED) : '—';
}
