<script lang="ts">
  import type { ModalProps } from '$lib/frontend/components/utils';
  import type { PrintRequestDto } from '$lib/remotes/dtos/print_request.dto';
  import { getPrintRequestFiles } from '$lib/remotes/endpoints/print_request.remote';
  import {
    Badge,
    Heading,
    HStack,
    Icon,
    IconButton,
    LoadingSpinner,
    Modal,
    ModalBody,
    Stack,
    Switch,
    Text,
  } from '@immich/ui';
  import { mdiAccount, mdiDownload, mdiEmail, mdiMonitorShare, mdiPrinter3dNozzle } from '@mdi/js';

  type Props = ModalProps & {
    request: PrintRequestDto;
  };

  const { request, onClose }: Props = $props();

  let printFiles = $derived(getPrintRequestFiles(request.id));
</script>

<Modal title={request.projectName} size="giant" {onClose} icon={mdiPrinter3dNozzle}>
  <ModalBody>
    <HStack gap={8} class="w-full items-start">
      <div class="flex flex-1 flex-col gap-4">
        <Stack class="rounded-2xl border-2 border-slate-700 p-4">
          <Heading size="medium">Customer Information</Heading>
          <HStack>
            <Icon icon={mdiAccount} size="24" />
            <Text>{request.customerName}</Text>
          </HStack>
          <HStack>
            <Icon icon={mdiEmail} size="24" />
            <Text><a href={`mailto:${request.email}`}>{request.email}</a></Text>
          </HStack>
        </Stack>
        <Stack class="rounded-2xl border-2 border-slate-700 p-4">
          <Stack>
            <HStack class="justify-between">
              <Heading size="tiny">Status</Heading>
              <Badge
                color={request.status === 'in_queue'
                  ? 'secondary'
                  : request.status === 'printing'
                    ? 'info'
                    : request.status === 'done'
                      ? 'success'
                      : 'danger'}
                size="small"
              >
                {request.status.replace('_', ' ').toUpperCase()}
              </Badge>
            </HStack>
            <HStack class="justify-between">
              <Heading size="tiny">Quote Requested</Heading>
              <Switch disabled checked={request.isQuote} />
            </HStack>
            <HStack class="justify-between">
              <Heading size="tiny">Print Material</Heading>
              <Text>{request.material.name}</Text>
            </HStack>
          </Stack>
        </Stack>
        {#if request.specialRequests}
          <Stack class="rounded-2xl border-2 border-slate-700 p-4">
            <Heading size="small">Special Requests</Heading>
            <Text>{request.specialRequests}</Text>
          </Stack>
        {/if}

        <Stack class="rounded-2xl border-2 border-slate-700 p-4">
          <Heading size="small" class="mb-2">Payment Information</Heading>
        </Stack>
      </div>
      <div class="flex h-full flex-1 flex-col">
        <HStack class="justify-between">
          <Heading size="medium">Print Files</Heading>
          <HStack gap={2}>
            <IconButton
              icon={mdiDownload}
              aria-label="Download Files"
              color="primary"
              size="small"
              href={`${window.location.origin}/api/print_download/${request.id}`}
            />
            <IconButton
              icon={mdiMonitorShare}
              aria-label="Send to OrcaSlicer"
              color="success"
              size="small"
              href={`orcaslicer://open?file=${encodeURIComponent(
                `${window.location.origin}/api/print_download/${request.id}`,
              )}`}
            />
          </HStack>
        </HStack>
        {#if printFiles.loading}
          <div class="flex w-full flex-col items-center justify-center">
            <LoadingSpinner size="large" />
          </div>
        {:else if printFiles.error}
          <Text class="text-danger">Error loading files: {printFiles.error.message}</Text>
        {/if}
        {#each printFiles.current as file}
          <div class="bg-level-2 mt-2 rounded-lg border border-slate-600 p-4">
            <HStack class="justify-between">
              <Text>{file.fileName}</Text>
              <Text>Quantity: {file.quantity}</Text>
            </HStack>
          </div>
        {/each}
      </div>
    </HStack>
  </ModalBody>
</Modal>
