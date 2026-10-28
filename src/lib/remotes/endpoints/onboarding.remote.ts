import { form, query } from '$app/server';
import { requestPassEmailDto, submitOnboardingWaiverDto } from '$lib/remotes/dtos/onboarding.dto';
import { HTTP_NOT_FOUND, INVALID_LINK_MESSAGE } from '$lib/remotes/utils';
import { onboardingService } from '$lib/server/services/onboarding.service';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';

export const getOnboarding = query(v.string(), async (token) => {
  const onboarding = await onboardingService.getOnboarding(token);
  if (!onboarding) error(HTTP_NOT_FOUND, INVALID_LINK_MESSAGE);
  return onboarding;
});

export const requestPassEmailForm = form(requestPassEmailDto, async ({ email }) => {
  await onboardingService.requestOnboardingEmail(email);
  return { requested: true };
});

export const submitOnboardingWaiverForm = form(submitOnboardingWaiverDto, async (dto) => {
  const submitted = await onboardingService.submitWaiver(dto);
  if (!submitted) error(HTTP_NOT_FOUND, INVALID_LINK_MESSAGE);
  await getOnboarding(dto.token).refresh();
});
