<script lang="ts">
  import { Input, type InputProps } from '@immich/ui';

  interface Props extends Omit<InputProps, 'value'> {
    value: string | number;
  }

  let props: Props = $props();
</script>

<Input {...props} value={props.value as string} />
