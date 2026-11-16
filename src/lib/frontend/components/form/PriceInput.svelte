<script lang="ts">
  import { cleanPriceText, priceFromText } from '$lib/frontend/price-text';
  import TextInput from './TextInput.svelte';
  import DollarSignIcon from '@lucide/svelte/icons/dollar-sign';

  const DECIMALS = 2;

  interface Props {
    value?: number;
    placeholder?: string;
    disabled?: boolean;
    multiplier?: number;
  }

  let {
    value = $bindable(0),
    placeholder = '0.00',
    disabled = false,
    multiplier = 1,
  }: Props = $props();

  // While focused the field shows what was typed; otherwise it follows `value`.
  let draft = $state<string>();

  const formatted = $derived((value / multiplier).toFixed(DECIMALS));
  const displayValue = $derived(draft ?? formatted);

  function handleFocus() {
    draft = formatted;
  }

  // Updates `value` as staff type, so buttons that depend on it don't wait for the field to blur.
  function handleInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const cleaned = cleanPriceText(input.value);

    if (input.value !== cleaned) {
      const cursorPos = input.selectionStart ?? 0;
      input.value = cleaned;
      input.setSelectionRange(cursorPos, cursorPos);
    }

    draft = cleaned;
    value = priceFromText(cleaned, multiplier);
  }

  function handleBlur() {
    draft = undefined;
  }
</script>

<TextInput
  type="text"
  inputmode="decimal"
  icon={DollarSignIcon}
  value={displayValue}
  onfocus={handleFocus}
  oninput={handleInput}
  onblur={handleBlur}
  {placeholder}
  {disabled}
/>
