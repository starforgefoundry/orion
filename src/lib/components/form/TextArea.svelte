<script lang="ts">
  import { Textarea, type InputProps } from '@immich/ui';

  interface Props extends Omit<InputProps, 'value'> {
    value: string | number;
  }

  let props: Props = $props();
</script>

<Textarea {...props} value={props.value as string} />
