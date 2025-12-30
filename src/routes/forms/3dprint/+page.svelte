<script lang="ts">
  import { goto } from '$app/navigation';
  import { getPrintMaterials, submitPrintRequestForm } from '$lib/api/3dprint.remote';
  import banner from '$lib/assets/3dp-banner.jpeg';
  import logo from '$lib/assets/logo.png';
  import FileUpload from '$lib/components/FileUpload.svelte';
  import NumberStepper from '$lib/components/form/NumberStepper.svelte';
  import TextArea from '$lib/components/form/TextArea.svelte';
  import TextInput from '$lib/components/form/TextInput.svelte';
  import {
    Alert,
    Button,
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

  let materials = await getPrintMaterials();
  let materialOptions: SelectItem[] = $derived(
    materials.map((material) => ({
      label: material.name,
      value: material.id,
    })),
  );

  let isQuote = $state(false);
  $effect(() => {
    submitPrintRequestForm.fields.isQuote.set(isQuote);
  });

  let files = $state<ReturnType<typeof submitPrintRequestForm.fields.files.value>>([]);
  $effect(() => {
    submitPrintRequestForm.fields.files.set(files);
  });

  let selectedMaterial: SelectItem | undefined = $state(undefined);
  $effect(() => {
    if (selectedMaterial) {
      submitPrintRequestForm.fields.material.set(selectedMaterial.value);
    } else {
      submitPrintRequestForm.fields.material.set('');
    }
  });

  let FILE_SIZE_LIMIT_MB = 1000;
  let totalBytes = $derived(files.reduce((acc, file) => acc + file.file.size, 0));
  let exceedsFileSizeLimit = $derived(totalBytes > FILE_SIZE_LIMIT_MB * 1024 * 1024);

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
</script>

<svelte:head>
  <title>3D Print Request</title>
</svelte:head>

<div class="h-64 w-full overflow-hidden">
  <img src={banner} alt="" class="h-full w-full object-cover" />
</div>

<div class="flex items-center justify-center p-4">
  <form
    {...submitPrintRequestForm}
    class="flex w-full max-w-3xl flex-col items-center justify-center gap-4"
    enctype="multipart/form-data"
    onsubmit={() => goto('/forms/3dprint/success')}
  >
    <img src={logo} alt="Orion Logo" class="mt-6 h-16 w-16 self-start" />

    <Heading class="self-start" size="giant">Starforge 3D Print Request</Heading>
    <Text>
      Please place your 3D Printed files in the form below to request 3D Prints. Please refer to our
      <a href="https://starforge.notion.site/Starforge-Wiki-d75b4653249d4599b3c44e953cda5c6e"
        >3D Printing Guide</a
      > for more information about our printers and suggestions on modeling.
    </Text>

    <Field label="Name" required="indicator">
      <TextInput
        {...submitPrintRequestForm.fields.customerName.as('text')}
        placeholder="John Doe"
        class="max-w-xs"
      />
    </Field>

    <Field label="Email" required="indicator">
      <TextInput
        {...submitPrintRequestForm.fields.customerEmail.as('text')}
        type="email"
        placeholder="john@example.com"
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
      description={`If you would like to use a mix of materials, please indicate which parts in "Special Requests".`}
    >
      <Select data={materialOptions} bind:value={selectedMaterial} placeholder="Select Material" />
      <input
        hidden
        {...submitPrintRequestForm.fields.material.as('text')}
        value={selectedMaterial?.value}
      />
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
        Total file size exceeds {FILE_SIZE_LIMIT_MB} MB limit. Please simplify your models or remove them
        from the request.
      </Alert>
    {/if}

    {#if files.length !== 0}
      <div class="flex w-full flex-col gap-2">
        {#each files as file, index}
          <div class="bg-level-1 flex w-full flex-row items-center justify-between rounded-xl p-4">
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
            <input {...submitPrintRequestForm.fields.files[index].filename.as('text')} hidden />
            <input {...submitPrintRequestForm.fields.files[index].quantity.as('number')} hidden />
            <input {...submitPrintRequestForm.fields.files[index].file.as('file')} hidden />
          </div>
        {/each}
      </div>
    {/if}

    <FileUpload
      onUpload={handleNewFile}
      onUnsupported={handleUnsupportedFile}
      supportedExtensions={['stl', '3mf', 'step', 'stp']}
    />

    <Button type="submit" class="mt-2 self-start" disabled={!submitEnabled}>Submit Request</Button>
  </form>
</div>
