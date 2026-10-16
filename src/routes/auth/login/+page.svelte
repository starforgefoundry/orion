<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import logo from '$lib/assets/logo.png';
  import SignInWithGoogle from '$lib/frontend/components/SignInWithGoogle.svelte';
  import { modalManager } from '$lib/frontend/modal-manager.svelte';
  import QrCodeIcon from '@lucide/svelte/icons/qr-code';
  import PairKioskDialog from './PairKioskDialog.svelte';
</script>

<svelte:head>
  <title>Login | Orion</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-sm flex-col px-4 py-10">
  <img class="mx-auto mb-6 w-16" src={logo} alt="Orion" />
  <Card.Root size="sm">
    <Card.Header>
      <Card.Title>Login</Card.Title>
    </Card.Header>
    <Card.Content>
      <SignInWithGoogle />
    </Card.Content>
  </Card.Root>
  <Button
    variant="ghost"
    class="mt-4 self-center"
    onclick={() => modalManager.show(PairKioskDialog)}
  >
    <QrCodeIcon />
    Pair kiosk
  </Button>
</div>
