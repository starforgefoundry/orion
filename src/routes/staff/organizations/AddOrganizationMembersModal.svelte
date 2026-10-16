<script lang="ts">
  import * as Alert from '$lib/components/ui/alert';
  import ModalForm from '$lib/frontend/components/ModalForm.svelte';
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import TextArea from '$lib/frontend/components/form/TextArea.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import UserPlusIcon from '@lucide/svelte/icons/user-plus';
  import { AddOrganizationMembersManager } from './organization-members.svelte';

  const TEXTAREA_ROWS = 8;

  type Props = ModalProps & { organizationId: string };

  let { onClose, organizationId }: Props = $props();

  const manager = new AddOrganizationMembersManager(() => organizationId);

  async function submit() {
    if (await manager.submit()) onClose();
  }
</script>

<ModalForm
  {onClose}
  title="Add Members"
  icon={UserPlusIcon}
  submitLabel="Add Members"
  submitIcon={UserPlusIcon}
  canSubmit={manager.canSubmit}
  submitting={manager.submitting}
  onSubmit={submit}
>
  <FormField
    label="Members"
    for="organization-member-lines"
    description={'One per line, as "Name <email>" or "Name, email". New members get an onboarding email.'}
  >
    <TextArea
      id="organization-member-lines"
      rows={TEXTAREA_ROWS}
      class="font-mono text-sm"
      placeholder={'Ada Lovelace <ada@example.com>\nGrace Hopper, grace@example.com'}
      bind:value={manager.lines}
    />
  </FormField>

  {#if manager.result}
    {@const result = manager.result}
    <p class="text-sm text-muted-foreground">
      Added {result.added.length}, already members {result.alreadyMembers.length}.
    </p>
    {#if result.errors.length}
      <Alert.Root variant="destructive">
        <Alert.Title>Some lines could not be read</Alert.Title>
        <Alert.Description>
          <ul class="list-inside list-disc">
            {#each result.errors as error (error.line)}
              <li>Line {error.line}: {error.text} — {error.reason}</li>
            {/each}
          </ul>
        </Alert.Description>
      </Alert.Root>
    {/if}
    {#if result.onboardingFailed.length}
      <Alert.Root variant="destructive">
        <Alert.Title>Added, but the onboarding email failed</Alert.Title>
        <Alert.Description>
          <ul class="list-inside list-disc">
            {#each result.onboardingFailed as line (line.line)}
              <li>{line.name} &lt;{line.email}&gt;</li>
            {/each}
          </ul>
        </Alert.Description>
      </Alert.Root>
    {/if}
  {/if}
</ModalForm>
