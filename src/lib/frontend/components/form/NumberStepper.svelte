<script lang="ts">
  import { HStack, IconButton, Text } from '@immich/ui';
  import { mdiMinus, mdiPlus } from '@mdi/js';

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

  function increment() {
    const newValue = Math.min(value + step, max);
    value = newValue;
    onChange?.(newValue);
  }

  function decrement() {
    const newValue = Math.max(value - step, min);
    value = newValue;
    onChange?.(newValue);
  }
</script>

<HStack gap={0}>
  <IconButton
    aria-label="Decrement"
    icon={mdiMinus}
    onclick={decrement}
    disabled={value <= min}
    shape="rectangle"
    size="medium"
    class="rounded-l-md aria-disabled:text-primary-300 aria-disabled:opacity-100 dark:aria-disabled:text-gray-500"
  />
  <div class="flex h-full items-center bg-primary">
    <div class="h-1/3 w-px bg-gray-300 dark:bg-gray-600"></div>
  </div>
  <Text
    class="flex h-10 w-10 items-center justify-center bg-primary text-white dark:text-black"
    size="medium">{value}</Text
  >
  <div class="flex h-full items-center bg-primary">
    <div class="h-1/3 w-px bg-gray-300 dark:bg-gray-600"></div>
  </div>
  <IconButton
    aria-label="Increment"
    icon={mdiPlus}
    onclick={increment}
    disabled={value >= max}
    shape="rectangle"
    size="medium"
    class="rounded-r-md aria-disabled:text-primary-300 aria-disabled:opacity-100 dark:aria-disabled:text-gray-500"
  />
</HStack>
