<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import DownloadIcon from '@lucide/svelte/icons/download';
  import { passImageFilename, renderPassImage } from './pass-image';

  let { name, passUrl }: { name: string; passUrl: string } = $props();

  let saving = $state(false);

  async function save() {
    saving = true;
    try {
      const link = document.createElement('a');
      link.href = await renderPassImage(passUrl, name);
      link.download = passImageFilename(name);
      link.click();
    } finally {
      saving = false;
    }
  }
</script>

<Button variant="ghost" onclick={save} disabled={saving}>
  {#if saving}<Spinner />{:else}<DownloadIcon />{/if}
  Save as image
</Button>
