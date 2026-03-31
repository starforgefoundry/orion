<script lang="ts">
  import { Button, Text } from '@immich/ui';

  let { signature = $bindable<File | null>(null) }: { signature: File | null } = $props();

  let canvas: HTMLCanvasElement;
  let isDrawing = $state(false);
  let hasDrawn = $state(false);

  function getCtx() {
    return canvas.getContext('2d')!;
  }

  function getPosition(event: MouseEvent | TouchEvent) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in event) {
      const touch = event.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  function startDrawing(event: MouseEvent | TouchEvent) {
    event.preventDefault();
    isDrawing = true;
    hasDrawn = true;
    const ctx = getCtx();
    const pos = getPosition(event);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function draw(event: MouseEvent | TouchEvent) {
    if (!isDrawing) return;
    event.preventDefault();
    const ctx = getCtx();
    const pos = getPosition(event);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000000';
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }

  function stopDrawing() {
    if (!isDrawing) return;
    isDrawing = false;
    // Fill white background before export so JPEG has a white bg
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const exportCtx = exportCanvas.getContext('2d')!;
    exportCtx.fillStyle = '#ffffff';
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    exportCtx.drawImage(canvas, 0, 0);
    exportCanvas.toBlob(
      (blob) => {
        if (blob) {
          signature = new File([blob], 'signature.jpg', { type: 'image/jpeg' });
        }
      },
      'image/jpeg',
      0.95,
    );
  }

  function clear() {
    const ctx = getCtx();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawn = false;
    signature = null;
  }
</script>

<div class="flex w-full max-w-lg flex-col gap-2">
  <div class="rounded-lg border-2 border-gray-300 bg-white">
    <canvas
      bind:this={canvas}
      width={600}
      height={200}
      class="w-full cursor-crosshair touch-none"
      onmousedown={startDrawing}
      onmousemove={draw}
      onmouseup={stopDrawing}
      onmouseleave={stopDrawing}
      ontouchstart={startDrawing}
      ontouchmove={draw}
      ontouchend={stopDrawing}
    ></canvas>
  </div>
  <div class="flex items-center justify-between">
    <Text size="small" color="muted">Draw your signature above</Text>
    {#if hasDrawn}
      <Button size="small" color="secondary" variant="ghost" onclick={clear}>Clear</Button>
    {/if}
  </div>
</div>
