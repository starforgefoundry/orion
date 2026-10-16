<script lang="ts">
  import { signIn } from '@auth/sveltekit/client';
  import { Button } from '$lib/components/ui/button';
</script>

<Button variant="outline" size="lg" class="w-full" onclick={() => signIn('google')}>
  <img
    class="size-5"
    src="https://www.svgrepo.com/show/475656/google-color.svg"
    loading="lazy"
    alt=""
  />
  Login with Google
</Button>
