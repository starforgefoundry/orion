<script lang="ts">
  import { goto } from '$app/navigation';
  import { announcementIsActive } from '$lib/frontend/announcement';
  import banner from '$lib/assets/3dp-banner.jpeg';
  import logo from '$lib/assets/logo.png';
  import FileUpload from '$lib/frontend/components/FileUpload.svelte';
  import NumberStepper from '$lib/frontend/components/form/NumberStepper.svelte';
  import TextArea from '$lib/frontend/components/form/TextArea.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import type { PrintRequestFileDto } from '$lib/remotes/dtos/print_request.dto';
  import { submitPrintRequestForm } from '$lib/remotes/endpoints/print_request.remote';
  import { getPublicPrintRequestForm } from '$lib/remotes/endpoints/settings.remote';
  import {
    Alert,
    Button,
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    Field,
    FormatBytes,
    Heading,
    IconButton,
    Select,
    Stack,
    Switch,
    Text,
    toastManager,
    type SelectItem,
  } from '@immich/ui';
  import { mdiTrashCan } from '@mdi/js';

  let printRequestSettings = await getPublicPrintRequestForm();

  let materialOptions: SelectItem[] = $derived(
    printRequestSettings.materials.map((material) => ({
      label: material.name,
      value: material.id,
    })),
  );

  let isQuote = $state(false);
  $effect(() => {
    submitPrintRequestForm.fields.isQuote.set(isQuote);
  });

  let files = $state<PrintRequestFileDto[]>([]);
  $effect(() => {
    submitPrintRequestForm.fields.files.set(files);
  });

  let selectedMaterial: SelectItem | undefined = $state(undefined);
  $effect(() => {
    submitPrintRequestForm.fields.material.set(selectedMaterial?.value ?? '');
  });

  let totalBytes = $derived(files.reduce((acc, file) => acc + file.file.size, 0));
  let exceedsFileSizeLimit = $derived(totalBytes > printRequestSettings.maxUploadMB * 1024 * 1024);
  let submitEnabled = $derived(files.length > 0 && !exceedsFileSizeLimit && selectedMaterial);

  function handleNewFile(file: File) {
    files.push({
      file,
      filename: file.name,
      quantity: 1,
    });
  }

  function handleUnsupportedFile(file: File) {
    toastManager.danger(`Unsupported file type: ${file.name}`);
  }

  let submitting = $state(false);
  let progress = $state(0);
  let submitButtonText = $derived(submitting ? `Submitting... (${progress}%)` : 'Submit Request');

  type SubmitParameters = Parameters<Parameters<typeof submitPrintRequestForm.enhance>[0]>[0];
  function handleSubmit({ form }: SubmitParameters) {
    submitting = true;
    progress = 0;

    const xhr = new XMLHttpRequest();
    const formData = new FormData(form);

    xhr.open(form.method, form.action, true);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        progress = Math.round((event.loaded / event.total) * 100);
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        progress = 100;
        submitting = false;
        goto('/print_request/form/success');
      } else {
        toastManager.danger('Failed to submit print request. Please try again later.');
        submitting = false;
        progress = 0;
      }
    };

    xhr.setRequestHeader('Accept', 'text/html');
    xhr.send(formData);
  }
</script>

<svelte:head>
  <title>3D Print Request</title>
</svelte:head>

<div class="h-64 w-full overflow-hidden">
  <img src={banner} alt="" class="h-full w-full object-cover" />
</div>

{#if announcementIsActive(printRequestSettings.announcement, printRequestSettings.announcementUntil)}
  <div class="flex items-center justify-center px-4 pt-4">
    <Alert color="warning" class="w-full max-w-3xl">
      <Text class="whitespace-pre-line">{printRequestSettings.announcement}</Text>
    </Alert>
  </div>
{/if}

{#if !printRequestSettings.isOpen}
  <div class="flex items-center justify-center p-4">
    <Card class="w-full max-w-3xl">
      <CardHeader>
        <CardTitle>Print Requests Are Closed</CardTitle>
      </CardHeader>
      <CardBody>
        We are not accepting print requests at this time. Please check back later. If you have
        questions, contact us at
        <a href="mailto:3dprint@starforgefoundry.com" class="underline">
          3dprint@starforgefoundry.com
        </a>.
      </CardBody>
    </Card>
  </div>
{:else}
  <div class="flex items-center justify-center p-4">
    <form
      {...submitPrintRequestForm.enhance(handleSubmit)}
      class="flex w-full max-w-3xl flex-col items-center justify-center gap-4"
      enctype="multipart/form-data"
    >
      <img src={logo} alt="Orion Logo" class="mt-6 h-16 w-16 self-start" />

      <Heading class="self-start" size="giant">Starforge 3D Print Request</Heading>
      <Text>
        Please place your 3D Printed files in the form below to request 3D Prints. Please refer to
        our
        <a
          href="https://starforge.notion.site/Starforge-Wiki-d75b4653249d4599b3c44e953cda5c6e"
          class="underline"
        >
          3D Printing Guide
        </a>
        for more information about our printers and suggestions on modeling.
      </Text>

      <Field label="Name" required="indicator">
        <TextInput
          {...submitPrintRequestForm.fields.customer.name.as('text')}
          placeholder="John Doe"
          class="max-w-xs"
        />
      </Field>

      <Field label="Email" required="indicator">
        <TextInput
          {...submitPrintRequestForm.fields.customer.email.as('text')}
          type="email"
          placeholder="john@example.com"
          class="max-w-xs"
        />
      </Field>

      <Field label="Group or Discount Code">
        <TextInput
          {...submitPrintRequestForm.fields.billingCode.as('text')}
          placeholder="ORG2026"
          class="max-w-xs"
        />
      </Field>

      <hr class="my-4 w-full border-gray-300" />
      <Field label="Project Title" required="indicator">
        <TextInput
          {...submitPrintRequestForm.fields.projectName.as('text')}
          placeholder="My Awesome Project"
          class="max-w-xs"
        />
      </Field>

      <Field
        label="I would like a quote before proceeding"
        description="If checked, Starforge will contact you with a quote before starting your print."
        class="border-secondary rounded-lg border-2 p-4"
      >
        <Switch bind:checked={isQuote} />
        <input {...submitPrintRequestForm.fields.isQuote.as('checkbox')} hidden />
      </Field>

      <Field label="Special Requests">
        <TextArea
          {...submitPrintRequestForm.fields.specialRequests.as('text')}
          class="h-35"
          placeholder="Enter any special instructions or requests here..."
        />
      </Field>

      <Field
        label="Material"
        required="indicator"
        description={`PLA is recommended for most projects. If you would like to use a mix of materials, please indicate which parts in "Special Requests".`}
      >
        <Select
          data={materialOptions}
          bind:value={selectedMaterial}
          placeholder="Select Material"
        />
        <input hidden {...submitPrintRequestForm.fields.material.as('text')} />
      </Field>

      <!-- FILE UPLOAD -->

      <Stack class="w-full" gap={2}>
        <Heading size="small" class="mt-2 self-start">Print Files</Heading>
        <Text class="-mt-2 self-start" size="small" color="muted">
          Upload your print files below and indicate any additional part quantities.
        </Text>
      </Stack>

      {#if exceedsFileSizeLimit}
        <Alert color="danger" class="self-start">
          Total file size exceeds {printRequestSettings.maxUploadMB} MB limit. Please simplify your models
          or remove them from the request.
        </Alert>
      {/if}

      {#if files.length !== 0}
        <div class="flex w-full flex-col gap-2">
          {#each files as file, index}
            <div
              class="bg-level-1 flex w-full flex-row items-center justify-between rounded-xl p-4"
            >
              <div>
                <Text fontWeight="bold">{file.filename}</Text>
                <Text size="small" color="secondary"><FormatBytes bytes={file.file.size} /></Text>
              </div>
              <div class="flex flex-row gap-2">
                <NumberStepper
                  value={file.quantity}
                  min={1}
                  onChange={(newValue) => (files[index].quantity = newValue)}
                />
                <IconButton
                  color="danger"
                  icon={mdiTrashCan}
                  aria-label="Remove file"
                  onclick={() => {
                    files.splice(index, 1);
                  }}
                />
              </div>
            </div>
            <input {...submitPrintRequestForm.fields.files[index].filename.as('text')} hidden />
            <input {...submitPrintRequestForm.fields.files[index].quantity.as('number')} hidden />
            <input {...submitPrintRequestForm.fields.files[index].file.as('file')} hidden />
          {/each}
        </div>
      {/if}

      <FileUpload
        onUpload={handleNewFile}
        onUnsupported={handleUnsupportedFile}
        supportedExtensions={printRequestSettings.allowedFileTypes
          .split(',')
          .map((ext) => ext.trim().replace(/^\./, ''))}
      />

      <Button type="submit" class="mt-2 self-start" disabled={!submitEnabled} loading={submitting}>
        {submitButtonText}
      </Button>

      <Text size="small" color="muted" class="mt-4 mb-8 self-start italic">
        If you have any issues or questions, please contact us at
        <a href="mailto:3dprint@starforgefoundry.com" class="underline">
          3dprint@starforgefoundry.com
        </a>
      </Text>
    </form>
  </div>
{/if}
