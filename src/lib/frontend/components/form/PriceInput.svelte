<script lang="ts">
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

  function handleInput(event: Event) {
    const input = event.target as HTMLInputElement;
    let rawValue = input.value;

    // Remove all non-numeric characters except the decimal point
    rawValue = rawValue.replace(/[^0-9.]/g, '');

    // Keep only the first decimal point
    const parts = rawValue.split('.');
    if (parts.length > 2) {
      rawValue = parts[0] + '.' + parts.slice(1).join('');
    }

    // Update the input value if we cleaned it
    if (input.value !== rawValue) {
      const cursorPos = input.selectionStart ?? 0;
      input.value = rawValue;
      input.setSelectionRange(cursorPos, cursorPos);
    }

    draft = rawValue;
  }

  function handleBlur() {
    const parsed = parseFloat(draft ?? formatted);
    value = isNaN(parsed) ? 0 : Math.round(parsed * multiplier);
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
