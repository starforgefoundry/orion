<script lang="ts">
  import SecureInput from '$lib/frontend/components/form/SecureInput.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import { initForm } from '$lib/frontend/components/form/utils.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import type { LocalPrinterDto } from '$lib/remotes/dtos/local_printer.dto';
  import { upsertLocalPrinter } from '$lib/remotes/endpoints/local_printer.remote';
  import { Button, Field, Modal, ModalBody, Stack } from '@immich/ui';
  import { mdiPrinter3d } from '@mdi/js';

  interface Props extends ModalProps {
    printer?: LocalPrinterDto;
  }

  let { onClose, printer }: Props = $props();

  initForm(upsertLocalPrinter, () => ({
    id: printer?.id,
    name: printer?.name ?? '',
    localIp: printer?.localIp ?? '',
    serial: printer?.serial ?? '',
    accessCode: printer?.accessCode ?? '',
  }));
</script>

<Modal
  title={printer ? 'Edit LAN Mode Printer' : 'Add LAN Mode Printer'}
  icon={mdiPrinter3d}
  {onClose}
>
  <ModalBody>
    <form {...upsertLocalPrinter} onsubmit={() => onClose()}>
      <input {...upsertLocalPrinter.fields.id.as('text')} value={printer?.id ?? ''} hidden />

      <Stack gap={4}>
        <Field label="Name" required="indicator">
          <TextInput {...upsertLocalPrinter.fields.name.as('text')} placeholder="e.g., SF-P1S-01" />
        </Field>

        <Field
          label="Local IP Address"
          required="indicator"
          description="The address the printer reports on your network"
        >
          <TextInput
            {...upsertLocalPrinter.fields.localIp.as('text')}
            placeholder="192.168.1.100"
          />
        </Field>

        <Field
          label="Serial Number"
          required="indicator"
          description="Found under Settings on the printer display"
        >
          <TextInput
            {...upsertLocalPrinter.fields.serial.as('text')}
            placeholder="01P00A000000000"
          />
        </Field>

        <Field
          label="Access Code"
          required="indicator"
          description="The LAN mode access code from the printer network settings"
        >
          <SecureInput
            {...upsertLocalPrinter.fields.accessCode.as('text')}
            placeholder="12345678"
          />
        </Field>

        <Button type="submit" variant="filled" fullWidth>
          {printer ? 'Update Printer' : 'Add Printer'}
        </Button>
      </Stack>
    </form>
  </ModalBody>
</Modal>
