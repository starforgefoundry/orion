<script lang="ts">
  import { Switch } from '$lib/components/ui/switch';
  import ModalForm from '$lib/frontend/components/ModalForm.svelte';
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { submitWithToast } from '$lib/frontend/form-submit';
  import { cancelMemberSubscription } from '$lib/remotes/endpoints/member.remote';
  import type { MemberSubscription } from '$lib/server/db/schema';
  import BanIcon from '@lucide/svelte/icons/ban';
  import { formatIsoDate } from '../display';

  type Props = ModalProps & {
    memberId: string;
    subscription: MemberSubscription;
  };

  let { onClose, memberId, subscription }: Props = $props();

  const alreadyCanceled = $derived(Boolean(subscription.canceledDate));
  const title = $derived(alreadyCanceled ? 'Refund Current Month' : 'Cancel Subscription');

  let refundRequested = $state(false);
  const refund = $derived(alreadyCanceled || refundRequested);
  let submitting = $state(false);

  async function submit() {
    submitting = true;
    try {
      const ok = await submitWithToast(
        () => cancelMemberSubscription({ memberId, subscriptionId: subscription.id, refund }),
        {
          success: alreadyCanceled ? 'Payment refunded' : 'Subscription canceled',
          error: alreadyCanceled ? 'Failed to refund payment' : 'Failed to cancel subscription',
        },
      );
      if (ok) onClose();
    } finally {
      submitting = false;
    }
  }
</script>

<ModalForm
  {onClose}
  {title}
  description={subscription.planName}
  icon={BanIcon}
  size="sm"
  submitLabel={title}
  {submitting}
  onSubmit={submit}
>
  <p class="text-sm text-muted-foreground">
    {#if refund}
      The latest payment is refunded and access ends immediately.
    {:else}
      Access continues through {formatIsoDate(subscription.chargedThroughDate)}, then the
      subscription ends.
    {/if}
  </p>

  {#if !alreadyCanceled}
    <FormField
      label="Refund current month"
      for="cancel-subscription-refund"
      description="Refunds the most recent payment in Square."
    >
      <Switch id="cancel-subscription-refund" bind:checked={refundRequested} />
    </FormField>
  {/if}
</ModalForm>
