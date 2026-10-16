<script lang="ts">
  import logo from '$lib/assets/logo.png';
  import * as Card from '$lib/components/ui/card';
  import SignInWithGoogle from '$lib/frontend/components/SignInWithGoogle.svelte';
</script>

<div class="flex justify-center px-4">
  <div class="w-full max-w-xs">
    <img class="mx-auto mt-10 mb-6 w-20" src={logo} alt="Orion" />
    <Card.Root>
      <Card.Header>
        <Card.Title>Login</Card.Title>
      </Card.Header>
      <Card.Content class="flex justify-center">
        <SignInWithGoogle />
      </Card.Content>
    </Card.Root>
  </div>
</div>
