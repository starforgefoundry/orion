<script lang="ts">
  import { page } from '$app/state';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import logo from '$lib/assets/logo.png';

  const error = page.url.searchParams.get('error');

  let errorMessage = $state(
    error === 'AccessDenied'
      ? 'You are not authorized to access Orion.'
      : 'An unknown error occurred.',
  );
  let errorTitle = $state(error == 'AccessDenied' ? 'Unauthorized' : 'Login Failed');
</script>

<svelte:head>
  <title>Login Error | Orion</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-sm flex-col px-4 py-10">
  <img class="mx-auto mb-6 w-16" src={logo} alt="Orion" />
  <Card.Root size="sm">
    <Card.Header>
      <Card.Title>{errorTitle}</Card.Title>
    </Card.Header>
    <Card.Content>
      <p class="text-muted-foreground">{errorMessage}</p>
      <Button href="/auth/login" class="w-full">Return to Login</Button>
    </Card.Content>
  </Card.Root>
</div>
