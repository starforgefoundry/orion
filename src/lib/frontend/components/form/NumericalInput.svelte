<script lang="ts">
  import { NumberInput, type NumberInputProps } from '@immich/ui';

  type Props = Omit<NumberInputProps, 'value'> & {
    value: string | number;
  };

  let props: Props = $props();
  $inspect(props.value);
</script>

<NumberInput {...props} bind:value={props.value as number} />
