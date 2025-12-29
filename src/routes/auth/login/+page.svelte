<script lang="ts">
  import SignInWithGoogle from '$lib/components/SignInWithGoogle.svelte';
  import { Card, CardBody, CardHeader, CardTitle } from '@immich/ui';
</script>

<div class="flex justify-center">
  <div class="align-center mx-5 my-3 size-fit">
    <!-- <img class="mx-auto my-10 w-100" src={logo} alt="Share Tea" /> -->
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
