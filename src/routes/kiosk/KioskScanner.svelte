<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import logo from '$lib/assets/logo.png';
  import MailIcon from '@lucide/svelte/icons/mail';
  import QrCodeIcon from '@lucide/svelte/icons/qr-code';
  import KioskCameraView from './KioskCameraView.svelte';

  interface Props {
    checking: boolean;
    /** Something is drawn over the scanner, so the native camera must step aside. */
    covered: boolean;
    onScan: (value: string) => void;
    onRequestPassEmail: () => void;
  }

  let { checking, covered, onScan, onRequestPassEmail }: Props = $props();
</script>

<div class="grid h-full grid-cols-1 gap-8 p-8 landscape:grid-cols-[3fr_2fr]">
  <KioskCameraView busy={checking} {covered} {onScan} />

  <div class="flex flex-col items-center justify-center gap-8 text-center">
    <img src={logo} alt="Starforge" class="size-28" />
    <div class="flex flex-col gap-3">
      <h1 class="text-5xl font-semibold">Welcome to Starforge</h1>
      <p class="text-2xl text-muted-foreground">Hold your member pass QR code up to the camera.</p>
    </div>
    <QrCodeIcon class="size-24 text-muted-foreground" />
    <Button variant="outline" class="h-16 px-8 text-xl" onclick={onRequestPassEmail}>
      <MailIcon class="size-6" />
      Don't have your pass? Email it to me
    </Button>
  </div>
</div>
