<script lang="ts">
  import { PasswordInput, type InputProps } from '@immich/ui';

  type Props = Omit<InputProps, 'value'> & {
    value: string | number;
  };

  let props: Props = $props();
</script>

<PasswordInput {...props} value={props.value as string} />
