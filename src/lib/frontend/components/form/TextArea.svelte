<script lang="ts">
  import { Textarea, type TextareaProps } from '@immich/ui';

  interface Props extends Omit<TextareaProps, 'value'> {
    value: string | number;
  }

  let props: Props = $props();
</script>

<Textarea {...props} value={props.value as string} />
