<script lang="ts">
  import { page } from '$app/state';
  import banner from '$lib/assets/space-banner.jpg';
  import logo from '$lib/assets/logo.png';
  import { Spinner } from '$lib/components/ui/spinner';
  import StepProgress from '$lib/frontend/components/StepProgress.svelte';
  import PassImage from '$lib/frontend/member-pass/PassImage.svelte';
  import SavePassImageButton from '$lib/frontend/member-pass/SavePassImageButton.svelte';
  import WalletButtons from '$lib/frontend/member-pass/WalletButtons.svelte';
  import { getOnboarding } from '$lib/remotes/endpoints/onboarding.remote';
  import OnboardingWaiverForm from './OnboardingWaiverForm.svelte';

  const CONTACT_EMAIL = 'contact@starforgefoundry.com';
  const PASS_LABEL = 'Member Pass';

  const STEPS = { WAIVER: 'waiver', PASS: 'pass' } as const;
  const STEP_LIST = [
    { id: STEPS.WAIVER, label: 'Sign Waiver' },
    { id: STEPS.PASS, label: 'Save Your Pass' },
  ];

  const token = page.params.token ?? '';
  const onboardingRemote = getOnboarding(token);
  const onboarding = $derived(onboardingRemote.current);
  const step = $derived(onboarding?.hasWaiver ? STEPS.PASS : STEPS.WAIVER);
</script>

<svelte:head>
  <title>Welcome - Starforge</title>
</svelte:head>

<header class="relative h-48 w-full overflow-hidden sm:h-60">
  <img src={banner} alt="" class="absolute inset-0 h-full w-full object-cover" />
  <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/10"></div>
  <div class="relative mx-auto flex h-full max-w-3xl items-end px-4 pb-6">
    <div class="flex items-center gap-4">
      <img src={logo} alt="Starforge" class="size-12 shrink-0 sm:size-14" />
      <div class="min-w-0 text-white">
        <h1 class="text-2xl font-semibold sm:text-3xl">
          Welcome{onboarding ? `, ${onboarding.name}` : ''}!
        </h1>
        <p class="text-sm text-white/80">Set up your Starforge Foundry access.</p>
      </div>
    </div>
  </div>
</header>

<div class="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
  {#if onboardingRemote.error}
    <div class="rounded-lg border p-4 text-sm">
      <p class="font-medium text-destructive">Link not found.</p>
      <p class="mt-1 text-muted-foreground">This link may be invalid or out of date.</p>
    </div>
  {:else if !onboarding}
    <Spinner class="mx-auto mt-12 size-8" />
  {:else}
    <StepProgress steps={STEP_LIST} current={step} showCompleted />

    {#if step === STEPS.WAIVER}
      <OnboardingWaiverForm {token} name={onboarding.name} email={onboarding.email} />
    {:else}
      <section class="flex flex-col items-center gap-5">
        <p class="self-start text-sm text-muted-foreground">
          Add your pass to your wallet so it's ready when you arrive.
        </p>
        <PassImage name={onboarding.name} passUrl={onboarding.passUrl} label={PASS_LABEL} />
        <WalletButtons token={onboarding.passToken} wallets={onboarding.wallets} />
        <SavePassImageButton
          name={onboarding.name}
          passUrl={onboarding.passUrl}
          label={PASS_LABEL}
        />
      </section>
    {/if}
  {/if}

  <p class="text-sm text-muted-foreground">
    Questions? Contact us at
    <a href={`mailto:${CONTACT_EMAIL}`} class="underline">{CONTACT_EMAIL}</a>
  </p>
</div>
