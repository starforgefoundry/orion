import * as v from 'valibot';

export const submitOnboardingWaiverDto = v.object({
  token: v.pipe(v.string(), v.minLength(1)),
  name: v.pipe(v.string(), v.trim(), v.minLength(1)),
  signature: v.file(),
  isAdult: v.pipe(
    v.optional(v.boolean(), false),
    v.check((isAdult) => isAdult, 'You must be 18 or older to use the space'),
  ),
});

export type SubmitOnboardingWaiverDto = v.InferOutput<typeof submitOnboardingWaiverDto>;

export const requestPassEmailDto = v.object({
  email: v.pipe(v.string(), v.trim(), v.email()),
});

export type OnboardingDto = {
  name: string;
  email: string;
  passToken: string;
  hasWaiver: boolean;
};
