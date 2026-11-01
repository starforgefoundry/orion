<script lang="ts">
  import * as Alert from '$lib/components/ui/alert';
  import * as Tabs from '$lib/components/ui/tabs';
  import Modal from '$lib/frontend/components/Modal.svelte';
  import QueryState from '$lib/frontend/components/QueryState.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { DESKTOP_BREAKPOINT, IsMobile } from '$lib/hooks/is-mobile.svelte';
  import FileWarningIcon from '@lucide/svelte/icons/file-warning';
  import Printer3dIcon from '@lucide/svelte/icons/printer-3d';
  import RequestComments from './RequestComments.svelte';
  import RequestDetailFooter from './RequestDetailFooter.svelte';
  import RequestDetailsTab from './RequestDetailsTab.svelte';
  import RequestFilesTab from './RequestFilesTab.svelte';
  import StatusIndicator from './StatusIndicator.svelte';
  import { REQUEST_DETAIL_TABS, RequestDetail } from './request-detail.svelte';
  import { REQUEST_STATUS_DISPLAY } from './utils';

  type Props = ModalProps & {
    requestId: string;
  };

  const { requestId, onClose }: Props = $props();

  const belowDesktop = new IsMobile(DESKTOP_BREAKPOINT);
  const detail = new RequestDetail(
    () => requestId,
    () => onClose(),
  );
</script>

{#snippet footer()}
  <RequestDetailFooter {detail} />
{/snippet}

<Modal
  title={detail.request?.projectName ?? 'Print Request'}
  size="full"
  icon={Printer3dIcon}
  onClose={() => detail.close()}
  footer={detail.hasFooterActions ? footer : undefined}
  class="flex flex-col gap-4 max-lg:px-3 lg:p-5"
>
  {#snippet headerActions()}
    {#if detail.request}
      <StatusIndicator display={REQUEST_STATUS_DISPLAY[detail.request.status]} size="lg" />
    {/if}
  {/snippet}

  <QueryState query={detail.query} label="print request">
    {#snippet children(request)}
      {#if detail.quoteNotice}
        <Alert.Root variant="warning">
          <FileWarningIcon />
          <Alert.Title>{detail.quoteNotice.title}</Alert.Title>
          <Alert.Description>{detail.quoteNotice.description}</Alert.Description>
        </Alert.Root>
      {/if}

      {#if !belowDesktop.current}
        <div class="grid grid-cols-[3fr_2fr] gap-4">
          <div class="flex min-w-0 flex-col gap-4">
            <RequestDetailsTab {detail} {request} />
            <RequestFilesTab {detail} {request} />
          </div>
          <div class="flex min-h-[30rem] flex-col">
            <RequestComments {requestId} />
          </div>
        </div>
      {:else}
        <Tabs.Root bind:value={detail.activeTab} class="flex min-h-0 flex-1 flex-col">
          <Tabs.List class="w-full">
            <Tabs.Trigger value={REQUEST_DETAIL_TABS.DETAILS}>Details</Tabs.Trigger>
            <Tabs.Trigger value={REQUEST_DETAIL_TABS.FILES}>
              Files ({request.files.length})
            </Tabs.Trigger>
            <Tabs.Trigger value={REQUEST_DETAIL_TABS.COMMENTS}>
              Comments ({detail.commentCount})
            </Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value={REQUEST_DETAIL_TABS.DETAILS}>
            <RequestDetailsTab {detail} {request} />
          </Tabs.Content>
          <Tabs.Content value={REQUEST_DETAIL_TABS.FILES}>
            <RequestFilesTab {detail} {request} />
          </Tabs.Content>
          <Tabs.Content value={REQUEST_DETAIL_TABS.COMMENTS} class="flex min-h-[60dvh] flex-col">
            <RequestComments {requestId} />
          </Tabs.Content>
        </Tabs.Root>
      {/if}
    {/snippet}
  </QueryState>
</Modal>
