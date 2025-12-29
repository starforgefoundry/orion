<script lang="ts">
  import logo from '$lib/assets/logo.png';
  import SignInWithGoogle from '$lib/components/SignInWithGoogle.svelte';
  import { Card, CardBody, CardHeader, CardTitle } from '@immich/ui';
</script>

<svelte:head>
    <title>Login | Orion</title>
</svelte:head>

<div class="flex justify-center">
  <div class="align-center mx-5 my-3 size-fit">
    <img class="mx-auto mt-10 mb-6 w-20" src={logo} alt="Orion" />
    <Card>
      <CardHeader>
        <CardTitle>Login</CardTitle>
      </CardHeader>
      <CardBody>
        <div class="flex justify-center">
          <SignInWithGoogle />
        </div>
      </CardBody>
    </Card>
  </div>
</div>
