<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import * as ButtonGroup from '$lib/components/ui/button-group';
  import MinusIcon from '@lucide/svelte/icons/minus';
  import PlusIcon from '@lucide/svelte/icons/plus';

  type Props = {
    value: number;
    min?: number;
    max?: number;
    step?: number;
    onChange?: (newValue: number) => void;
  };

  let {
    value = $bindable(0),
    min = -Infinity,
    max = Infinity,
    step = 1,
    onChange,
  }: Props = $props();

  function update(newValue: number) {
    value = Math.min(Math.max(newValue, min), max);
    onChange?.(value);
  }
</script>

<ButtonGroup.Root>
  <Button
    variant="outline"
    size="icon"
    aria-label="Decrement"
    disabled={value <= min}
    onclick={() => update(value - step)}
  >
    <MinusIcon />
  </Button>
  <ButtonGroup.Text class="min-w-10 justify-center tabular-nums">{value}</ButtonGroup.Text>
  <Button
    variant="outline"
    size="icon"
    aria-label="Increment"
    disabled={value >= max}
    onclick={() => update(value + step)}
  >
    <PlusIcon />
  </Button>
</ButtonGroup.Root>
