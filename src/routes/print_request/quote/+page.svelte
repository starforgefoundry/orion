<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import {
    getPrintRequestQuote,
    respondToPrintRequestQuote,
  } from '$lib/remotes/endpoints/print_request.remote';
  import {
    Badge,
    Button,
    CardBody,
    CardHeader,
    CardTitle,
    Heading,
    HStack,
    Icon,
    LoadingSpinner,
    modalManager,
    Stack,
    Text,
  } from '@immich/ui';
  import { mdiCheckCircle, mdiClose, mdiHelp, mdiReceipt } from '@mdi/js';
  import type { Order } from 'square';

  const requestRemote = getPrintRequestQuote(page.url.searchParams.get('id') ?? '');
  const request = $derived(requestRemote.current);
  const payment = $derived(request?.payment);

  // Calculate values from payment data
  const order = $derived(JSON.parse(payment?.orderObject ?? '{}') as Order);
  const totalCost = $derived((payment?.total ?? 0) / 100);

  let submitting = $state(false);

  async function handleApprove() {
    submitting = true;

    await respondToPrintRequestQuote({
      id: request!.id,
      approve: true,
    });

    await goto('/print_request/quote/approved');
  }

  async function handleCancel() {
    const cancel = await modalManager.showDialog({
      title: 'Cancel Print Request',
      prompt: 'Are you sure you want to cancel this print request? This action cannot be undone.',
      confirmText: 'Cancel Request',
      confirmColor: 'danger',
      icon: mdiHelp,
    });

    if (cancel) {
      submitting = true;

      await respondToPrintRequestQuote({
        id: request!.id,
        approve: false,
      });

      await goto('/print_request/quote/canceled');
    }
  }
</script>

<CardHeader>
  <div class="flex items-center justify-start gap-2">
    <Icon icon={mdiReceipt} size="1.5rem" aria-hidden />
    <CardTitle>3D Print Request Quote</CardTitle>
  </div>
</CardHeader>
<CardBody>
  {#if requestRemote.loading}
    <LoadingSpinner class="mx-auto" size="large" />
  {:else if requestRemote.error || !request || !request.payment}
    <Text color="danger" class="mb-4" fontWeight="bold"
      >Unable to fetch quote for this print request.</Text
    >
    <Text>
      This could be because you have already cancelled the request or the quote is no longer
      available.
    </Text>

    <Text class="mt-4">
      If you have any questions, please contact us at
      <a href="mailto:3dprint@starforgefoundry.com" class="text-primary">
        3dprint@starforgefoundry.com
      </a>
    </Text>
  {:else}
    <div class="space-y-6">
      <Text class="mb-2" color="muted">TOTAL</Text>
      <Heading class="text-5xl">${totalCost.toFixed(2)}</Heading>

      <!-- Action Buttons -->
      {#if submitting}
        <LoadingSpinner class="mx-auto" size="large" />
      {:else}
        <Stack gap={2}>
          <Button fullWidth color="success" leadingIcon={mdiCheckCircle} onclick={handleApprove}>
            Approve Quote
          </Button>
          <Button fullWidth color="danger" onclick={handleCancel} leadingIcon={mdiClose}
            >Cancel Request</Button
          >
        </Stack>
      {/if}

      <!-- Request Information -->
      <Stack class="rounded-2xl border-2 border-slate-700 p-4">
        <Heading size="small">Request Details</Heading>
        <HStack class="justify-between">
          <Text>Project Name</Text>
          <Text fontWeight="bold">{request?.projectName}</Text>
        </HStack>
        <HStack class="justify-between">
          <Text>Material</Text>
          <Text fontWeight="bold">{request?.material?.name}</Text>
        </HStack>
        <HStack class="justify-between">
          <Text>Email</Text>
          <Badge color="secondary" size="small">
            {request?.email}
          </Badge>
        </HStack>
      </Stack>

      <!-- Price Breakdown -->
      <Stack class="rounded-2xl border-2 border-slate-700 p-4">
        <Heading size="small" class="mb-2">Price Breakdown</Heading>
        <Stack>
          {#each order.lineItems as item}
            <HStack class="justify-between">
              <Stack gap={0}>
                <Text>{item.name?.replace('3D Print Request - ', '')}</Text>
                {#if Number(item.quantity) > 1}
                  <Text size="small" color="muted">
                    {item.quantity}x - ${(Number(item.basePriceMoney?.amount ?? 0) / 100).toFixed(
                      2,
                    )} each
                  </Text>
                {/if}
              </Stack>
              <Text>
                ${(Number(item.grossSalesMoney?.amount ?? 0) / 100).toFixed(2)}
              </Text>
            </HStack>
          {/each}

          {#each order.discounts as discount}
            <HStack class="justify-between">
              <Stack gap={0}>
                <Text>{discount.name?.replace('3D Print Request - ', '')}</Text>
                {#if Number(discount.percentage) > 0}
                  <Text size="small" color="muted">
                    {Number(discount.percentage).toFixed(0)}% Off
                  </Text>
                {/if}
              </Stack>
              <Text>
                - ${discount.appliedMoney
                  ? (
                      Number(
                        discount.appliedMoney?.amount ?? 0 * (Number(discount.percentage) / 100),
                      ) / 100
                    ).toFixed(2)
                  : '0.00'}
              </Text>
            </HStack>
          {/each}

          <hr class="mt-1 mb-2 w-1/3 self-end border-slate-700" />

          <HStack class="justify-between">
            <Text fontWeight="bold">TOTAL</Text>
            <Text>
              ${totalCost.toFixed(2)}
            </Text>
          </HStack>
        </Stack>
      </Stack>
    </div>
  {/if}
</CardBody>
