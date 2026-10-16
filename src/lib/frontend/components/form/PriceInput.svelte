<script lang="ts">
  import TextInput from './TextInput.svelte';
  import DollarSignIcon from '@lucide/svelte/icons/dollar-sign';

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

  let displayValue = $derived((value / multiplier).toFixed(2));

  // Update display when value changes externally
  $effect(() => {
    if (document.activeElement?.tagName !== 'INPUT') {
      displayValue = (value / multiplier).toFixed(2);
    }
  });

  function handleInput(event: Event) {
    const input = event.target as HTMLInputElement;
    let rawValue = input.value;

    // Remove all non-numeric characters except decimal point and minus sign
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

    displayValue = rawValue;
  }

  function handleBlur() {
    // Parse and format to 2 decimal places on blur
    const parsed = parseFloat(displayValue);

    if (isNaN(parsed)) {
      value = 0;
      displayValue = '0.00';
    } else {
      value = Math.round(parsed * multiplier);
      displayValue = (value / multiplier).toFixed(2);
    }
  }
</script>

<TextInput
  type="text"
  inputmode="decimal"
  icon={DollarSignIcon}
  value={displayValue}
  oninput={handleInput}
  onblur={handleBlur}
  {placeholder}
  {disabled}
/>
