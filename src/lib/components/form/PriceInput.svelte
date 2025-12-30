<script lang="ts">
  import { Input } from '@immich/ui';
  import { mdiCurrencyUsd } from '@mdi/js';

  interface Props {
    value?: number;
    placeholder?: string;
    disabled?: boolean;
  }

  let { value = $bindable(0), placeholder = '0.00', disabled = false }: Props = $props();

  let displayValue = $state(value?.toFixed(2) ?? '0.00');

  function handleKeydown(event: KeyboardEvent) {
    const input = event.target as HTMLInputElement;
    const key = event.key;

    // Allow control keys
    if (
      key === 'Backspace' ||
      key === 'Delete' ||
      key === 'Tab' ||
      key === 'Escape' ||
      key === 'Enter' ||
      key === 'ArrowLeft' ||
      key === 'ArrowRight' ||
      key === 'ArrowUp' ||
      key === 'ArrowDown' ||
      key === 'Home' ||
      key === 'End' ||
      event.ctrlKey ||
      event.metaKey // Allow copy/paste/select all
    ) {
      return;
    }

    // Only allow digits and decimal point
    if (!/^[0-9.]$/.test(key)) {
      event.preventDefault();
      return;
    }

    // Prevent multiple decimal points
    if (key === '.' && input.value.includes('.')) {
      event.preventDefault();
      return;
    }

    // Limit to 2 decimal places
    const cursorPos = input.selectionStart ?? 0;
    const decimalIndex = input.value.indexOf('.');
    if (decimalIndex !== -1 && cursorPos > decimalIndex) {
      const decimals = input.value.slice(decimalIndex + 1);
      if (decimals.length >= 2 && input.selectionStart === input.selectionEnd) {
        event.preventDefault();
        return;
      }
    }
  }

  function handleInput(event: Event) {
    const input = event.target as HTMLInputElement;
    displayValue = input.value;
    value = parseFloat(input.value) || 0;
  }

  function handleBlur() {
    // Format to 2 decimal places on blur
    displayValue = value.toFixed(2);
  }
</script>

<Input
  type="text"
  inputmode="decimal"
  leadingIcon={mdiCurrencyUsd}
  value={displayValue}
  onkeydown={handleKeydown}
  oninput={handleInput}
  onblur={handleBlur}
  {placeholder}
  {disabled}
/>
