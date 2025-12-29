<script lang="ts">
  import { page } from '$app/state';
  import logo from '$lib/assets/logo.png';
  import { Button, Card, CardBody, CardHeader, CardTitle } from '@immich/ui';

  const error = page.url.searchParams.get('error');

  let errorMessage = 'An unknown error occurred.';
  let errorTitle = 'Sign-In Failed';

  if (error === 'AccessDenied') {
    errorTitle = 'Access Denied';
    errorMessage = 'You are not authorized to access Polaris.';
  } else if (error) {
    errorMessage = `An error occurred during authentication. Code: ${error}`;
  }
</script>

<div class="flex justify-center">
  <div class="align-center mx-5 my-3 size-fit">
    <img class="mx-auto mt-10 mb-6 w-20" src={logo} alt="Polaris" />
    <Card>
      <CardHeader>
        <CardTitle>Login Failed</CardTitle>
      </CardHeader>
      <CardBody>
        <p>{errorMessage}</p>

        <Button fullWidth href="/auth/login" color="primary" class="mt-4">Return to Login</Button>
      </CardBody>
    </Card>
  </div>
</div>
