import { form, query } from '$app/server';
import { submitOnboardingWaiverDto } from '$lib/remotes/dtos/onboarding.dto';
import { HTTP_NOT_FOUND } from '$lib/remotes/utils';
import { onboardingService } from '$lib/server/services/onboarding.service';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';

const MEMBER_NOT_FOUND = 'This link is invalid or has expired';

export const getMemberPass = query(v.string(), async (token) => {
  const pass = await onboardingService.getMemberPass(token);
  if (!pass) error(HTTP_NOT_FOUND, MEMBER_NOT_FOUND);
  return pass;
});

export const getOnboarding = query(v.string(), async (token) => {
  const onboarding = await onboardingService.getOnboarding(token);
  if (!onboarding) error(HTTP_NOT_FOUND, MEMBER_NOT_FOUND);
  return onboarding;
});

export const submitOnboardingWaiverForm = form(submitOnboardingWaiverDto, async (dto) => {
  const submitted = await onboardingService.submitWaiver(dto);
  if (!submitted) error(HTTP_NOT_FOUND, MEMBER_NOT_FOUND);
  await getOnboarding(dto.token).refresh();
});
