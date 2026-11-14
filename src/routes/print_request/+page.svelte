<script lang="ts">
  import { parseFileExtensions } from '$lib/utils/print-request';
  import * as Alert from '$lib/components/ui/alert';
  import { Button } from '$lib/components/ui/button';
  import * as Field from '$lib/components/ui/field';
  import { Spinner } from '$lib/components/ui/spinner';
  import { Switch } from '$lib/components/ui/switch';
  import { announcementIsActive } from '$lib/frontend/announcement';
  import FileDropArea from '$lib/frontend/components/FileDropArea.svelte';
  import IconButton from '$lib/frontend/components/IconButton.svelte';
  import StepProgress from '$lib/frontend/components/StepProgress.svelte';
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import HiddenField from '$lib/frontend/components/form/HiddenField.svelte';
  import OptionSelect from '$lib/frontend/components/form/OptionSelect.svelte';
  import NumberStepper from '$lib/frontend/components/form/NumberStepper.svelte';
  import TextArea from '$lib/frontend/components/form/TextArea.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import { submitPrintRequestForm } from '$lib/remotes/endpoints/print-request.remote';
  import { getPublicPrintRequestForm } from '$lib/remotes/endpoints/settings.remote';
  import { cn } from '$lib/frontend/cn';
  import { formatBytes } from '$lib/frontend/format';
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
  import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
  import FileBoxIcon from '@lucide/svelte/icons/file-box';
  import FilePlusIcon from '@lucide/svelte/icons/file-plus';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import TrashIcon from '@lucide/svelte/icons/trash';
  import { toast } from 'svelte-sonner';
  import { PrintRequestForm, STEPS } from './print-request-form.svelte';
  import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
  import ContactLine from './ContactLine.svelte';
  import HowItWorks from './HowItWorks.svelte';
  import PrintRequestBanner from './PrintRequestBanner.svelte';
  import RequestsClosed from './RequestsClosed.svelte';

  let printRequestSettings = await getPublicPrintRequestForm();

  const manager = new PrintRequestForm(printRequestSettings.maxUploadMB);

  const materialOptions = $derived(
    printRequestSettings.materials.map((material) => ({
      label: material.name,
      value: material.id,
    })),
  );

  const supportedExtensions = $derived(parseFileExtensions(printRequestSettings.allowedFileTypes));

  $effect(() => {
    submitPrintRequestForm.fields.files.set(manager.files);
  });

  const STEP_LIST = [
    { id: STEPS.CONTACT, label: 'Your Info' },
    { id: STEPS.PROJECT, label: 'Project & Files' },
  ];
</script>

<svelte:head>
  <title>3D Print Request</title>
</svelte:head>

<PrintRequestBanner />

<div class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
  {#if announcementIsActive(printRequestSettings.announcement, printRequestSettings.announcementUntil)}
    <Alert.Root variant="warning">
      <TriangleAlertIcon />
      <Alert.Description class="whitespace-pre-line">
        {printRequestSettings.announcement}
      </Alert.Description>
    </Alert.Root>
  {/if}

  {#if !printRequestSettings.isOpen}
    <RequestsClosed />
  {:else}
    <StepProgress steps={STEP_LIST} current={manager.step} />

    <!-- Both steps live in one form (step 1 is only hidden) so every field is submitted. -->
    <form
      {...submitPrintRequestForm.enhance((parameters) => manager.submit(parameters))}
      enctype="multipart/form-data"
    >
      <div class={cn('grid gap-6 lg:grid-cols-2', manager.step !== STEPS.CONTACT && 'hidden')}>
        <section class="flex flex-col gap-4 rounded-xl border bg-card p-5 sm:p-6">
          <h2 class="text-base font-semibold">Your Info</h2>
          <FormField label="Name" for="customer-name" required>
            <TextInput
              id="customer-name"
              {...submitPrintRequestForm.fields.customer.name.as('text')}
              placeholder="John Doe"
              autocomplete="name"
            />
          </FormField>

          <FormField
            label="Email"
            for="customer-email"
            required
            description="We'll send updates about your print here."
          >
            <TextInput
              id="customer-email"
              {...submitPrintRequestForm.fields.customer.email.as('text')}
              type="email"
              placeholder="john@example.com"
              autocomplete="email"
            />
          </FormField>

          <FormField
            label="Group Code"
            for="billing-code"
            description="Only if your organization is paying for this print."
          >
            <TextInput
              id="billing-code"
              {...submitPrintRequestForm.fields.billingCode.as('text')}
              placeholder="ORG2026"
            />
          </FormField>

          <Button
            size="lg"
            class="mt-2 sm:self-end"
            disabled={!manager.contactValid}
            onclick={() => manager.next()}
          >
            Continue
            <ArrowRightIcon />
          </Button>
        </section>

        <HowItWorks />
      </div>

      <div class={cn('flex flex-col gap-6', manager.step !== STEPS.PROJECT && 'hidden')}>
        <div class="grid gap-6 lg:grid-cols-2">
          <div class="flex flex-col gap-3">
            <section class="flex flex-col gap-4 rounded-xl border bg-card p-5 sm:p-6">
              <h2 class="text-base font-semibold">Project Details</h2>

              <FormField label="Project Title" for="project-name" required>
                <TextInput
                  id="project-name"
                  {...submitPrintRequestForm.fields.projectName.as('text')}
                  placeholder="My Awesome Project"
                />
              </FormField>

              <FormField
                label="Material"
                required
                description={`PLA is recommended for most projects. To mix materials, note which parts in "Special Requests".`}
              >
                <OptionSelect
                  options={materialOptions}
                  bind:value={manager.material}
                  placeholder="Select material"
                />
                <HiddenField
                  field={submitPrintRequestForm.fields.material}
                  value={manager.material}
                />
              </FormField>

              <FormField label="Special Requests" for="special-requests">
                <TextArea
                  id="special-requests"
                  {...submitPrintRequestForm.fields.specialRequests.as('text')}
                  class="min-h-32"
                  placeholder="Infill, supports, which parts use which material…"
                />
              </FormField>
            </section>
            <Field.Field orientation="horizontal" class="rounded-xl border bg-card p-5 sm:px-6">
              <Field.Content>
                <Field.Label for="is-quote">Get a quote first</Field.Label>
                <Field.Description>
                  We'll email you a price to approve before anything is printed.
                </Field.Description>
              </Field.Content>
              <Switch id="is-quote" bind:checked={manager.isQuote} />
              <HiddenField field={submitPrintRequestForm.fields.isQuote} value={manager.isQuote} />
            </Field.Field>
          </div>
          <FileDropArea
            onUpload={(file) => manager.addFile(file)}
            onUnsupported={(file) => toast.error(`Unsupported file type: ${file.name}`)}
            {supportedExtensions}
            class="flex flex-col gap-4 rounded-xl border bg-card p-5 sm:p-6"
          >
            {#snippet children({ open })}
              <div class="flex items-baseline justify-between gap-2">
                <h2 class="text-base font-semibold">Print Files</h2>
                <span
                  class={cn(
                    'text-sm tabular-nums',
                    manager.exceedsSizeLimit ? 'text-destructive' : 'text-muted-foreground',
                  )}
                >
                  {formatBytes(manager.totalBytes)} / {printRequestSettings.maxUploadMB} MB
                </span>
              </div>

              {#if manager.exceedsSizeLimit}
                <Alert.Root variant="destructive">
                  <TriangleAlertIcon />
                  <Alert.Description>
                    Total file size exceeds the {printRequestSettings.maxUploadMB} MB limit. Simplify
                    your models or remove some files.
                  </Alert.Description>
                </Alert.Root>
              {/if}

              {#if manager.files.length === 0}
                <button
                  type="button"
                  class="flex min-h-64 flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 text-center transition-colors hover:border-primary/70 hover:bg-muted/30 focus-visible:border-ring focus-visible:outline-none"
                  onclick={open}
                >
                  <FilePlusIcon class="size-10 text-muted-foreground" />
                  <span class="text-base">
                    <span class="font-medium">Click to upload</span>
                    <span class="text-muted-foreground">or drag and drop</span>
                  </span>
                  <span class="text-sm text-muted-foreground">
                    {supportedExtensions.join(', ')} · up to {printRequestSettings.maxUploadMB} MB total
                  </span>
                </button>
              {:else}
                <ul class="max-h-96 divide-y overflow-y-auto rounded-lg border">
                  {#each manager.files as file, index (file)}
                    <li class="flex items-center gap-2 p-2 pl-3">
                      <FileBoxIcon class="size-5 shrink-0 text-muted-foreground" />
                      <div class="min-w-0 flex-1">
                        <p class="truncate text-sm font-medium">{file.filename}</p>
                        <p class="text-xs text-muted-foreground">{formatBytes(file.file.size)}</p>
                      </div>
                      <NumberStepper
                        value={file.quantity}
                        min={1}
                        onChange={(quantity) => manager.setQuantity(index, quantity)}
                      />
                      <IconButton
                        icon={TrashIcon}
                        aria-label="Remove file"
                        class="text-destructive"
                        onclick={() => manager.removeFile(index)}
                      />
                      <input
                        {...submitPrintRequestForm.fields.files[index].filename.as('text')}
                        hidden
                      />
                      <input
                        {...submitPrintRequestForm.fields.files[index].quantity.as('number')}
                        hidden
                      />
                      <input
                        {...submitPrintRequestForm.fields.files[index].file.as('file')}
                        hidden
                      />
                    </li>
                  {/each}
                </ul>

                <button
                  type="button"
                  class="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground transition-colors hover:border-primary/70 hover:text-foreground focus-visible:border-ring focus-visible:outline-none"
                  onclick={open}
                >
                  <PlusIcon class="size-4" />
                  Add more files
                  <span class="text-xs">or drop them anywhere here</span>
                </button>
              {/if}
            {/snippet}
          </FileDropArea>
        </div>

        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button variant="outline" size="lg" onclick={() => manager.back()}>
            <ArrowLeftIcon />
            Back
          </Button>
          <Button type="submit" size="lg" disabled={!manager.canSubmit}>
            {#if manager.submitting}
              <Spinner />
              Submitting… ({manager.progress}%)
            {:else}
              Submit Request
            {/if}
          </Button>
        </div>
      </div>
    </form>
  {/if}

  {#if manager.step !== STEPS.CONTACT}
    <ContactLine />
  {/if}
</div>
