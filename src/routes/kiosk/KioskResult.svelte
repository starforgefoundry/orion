<script lang="ts">
  import { cn } from '$lib/frontend/cn';
  import {
    KIOSK_CHECK_IN_STATUS,
    type AdmittedBasis,
    type KioskDenialReason,
  } from '$lib/remotes/dtos/kiosk.dto';
  import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
  import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
  import CircleXIcon from '@lucide/svelte/icons/circle-x';
  import { KIOSK_ERROR, type KioskDisplayResult } from './kiosk-manager.svelte';

  interface Props {
    result: KioskDisplayResult;
    onDismiss: () => void;
  }

  let { result, onDismiss }: Props = $props();

  const BASIS_LABELS: Record<AdmittedBasis, string> = {
    subscription: 'Membership',
    organization: 'Organization membership',
    day_pass: 'Day pass',
    class: 'Class',
    car_bay: 'Car bay',
  };

  const DENIAL_DETAILS: Record<KioskDenialReason, string> = {
    no_access: 'No active membership — please see staff',
    not_today: "This pass isn't for today — please see staff",
    canceled: 'This booking was canceled — please see staff',
    already_used: 'This day pass was already used — please see staff',
  };

  const view = $derived.by(() => {
    switch (result.status) {
      case KIOSK_CHECK_IN_STATUS.ADMITTED:
        return {
          icon: CircleCheckIcon,
          tone: 'bg-success text-success-foreground',
          title: `Welcome, ${result.name}!`,
          detail: result.detail
            ? `${BASIS_LABELS[result.basis]}: ${result.detail}`
            : BASIS_LABELS[result.basis],
        };
      case KIOSK_CHECK_IN_STATUS.DENIED:
        return {
          icon: CircleXIcon,
          tone: 'bg-destructive text-white',
          title: `Sorry, ${result.name}`,
          detail: DENIAL_DETAILS[result.reason],
        };
      case KIOSK_CHECK_IN_STATUS.UNKNOWN_PASS:
        return {
          icon: CircleAlertIcon,
          tone: 'bg-destructive text-white',
          title: 'Pass not recognized',
          detail: 'Please see staff',
        };
      case KIOSK_ERROR:
        return {
          icon: CircleAlertIcon,
          tone: 'bg-destructive text-white',
          title: 'Something went wrong',
          detail: 'Please try again or see staff',
        };
    }
  });
</script>

<button
  type="button"
  class={cn(
    'flex h-full w-full flex-col items-center justify-center gap-8 p-12 text-center',
    view.tone,
  )}
  onclick={onDismiss}
>
  <view.icon class="size-40" />
  <h1 class="text-6xl font-semibold">{view.title}</h1>
  <p class="text-3xl opacity-90">{view.detail}</p>
</button>
