<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import { modalManager } from '$lib/frontend/modal-manager.svelte';
  import { getEmailTemplates } from '$lib/remotes/endpoints/email_template.remote';
  import { EMAIL_TEMPLATE_DEFINITIONS, type EmailTemplateGroup } from '$lib/utils/email_templates';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import EmailTemplateModal from './EmailTemplateModal.svelte';
  import SettingsSection from './SettingsSection.svelte';

  interface Props {
    group: EmailTemplateGroup;
    description: string;
  }

  const { group, description }: Props = $props();

  const templates = $derived(getEmailTemplates(group));
</script>

<SettingsSection title="Email Templates" {description}>
  {#if templates.error}
    <p class="text-sm text-destructive">Error loading email templates.</p>
  {:else if !templates.current}
    <Spinner />
  {:else}
    <ul class="divide-y rounded-lg border">
      {#each templates.current as template (template.key)}
        {@const definition = EMAIL_TEMPLATE_DEFINITIONS[template.key]}
        <li class="flex items-center justify-between gap-4 p-4">
          <div class="min-w-0">
            <p class="text-sm font-medium">{definition.name}</p>
            <p class="text-sm text-muted-foreground">{definition.description}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onclick={() => modalManager.show(EmailTemplateModal, { template })}
          >
            <PencilIcon />
            Edit
          </Button>
        </li>
      {/each}
    </ul>
  {/if}
</SettingsSection>
