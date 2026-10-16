<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import logo from '$lib/assets/logo.png';
  import SignInWithGoogle from '$lib/frontend/components/SignInWithGoogle.svelte';
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
</div>
