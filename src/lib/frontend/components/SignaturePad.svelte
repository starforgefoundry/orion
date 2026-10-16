<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import EraserIcon from '@lucide/svelte/icons/eraser';

  type Point = { x: number; y: number };

  // The saved image is printed with the waiver, so it is always black ink on white.
  const EXPORT_WIDTH = 900;
  const EXPORT_HEIGHT = 300;
  const EXPORT_INK = '#000000';
  const EXPORT_PAPER = '#ffffff';
  const EXPORT_QUALITY = 0.95;
  const LINE_WIDTH_RATIO = 0.02;
  const MIN_LINE_WIDTH = 2;

  let { signature = $bindable<File | null>(null) }: { signature: File | null } = $props();

  let canvas = $state<HTMLCanvasElement>();
  let strokes = $state.raw<Point[][]>([]);
  let activeStroke: Point[] | null = null;

  const hasDrawn = $derived(strokes.length > 0);

  function drawStrokes(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    ink: string,
  ) {
    context.lineWidth = Math.max(MIN_LINE_WIDTH, height * LINE_WIDTH_RATIO);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = ink;

    for (const stroke of strokes) {
      context.beginPath();
      stroke.forEach((point, index) => {
        const x = point.x * width;
        const y = point.y * height;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      if (stroke.length === 1) context.lineTo(stroke[0].x * width + 0.1, stroke[0].y * height);
      context.stroke();
    }
  }

  function render() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;

    const context = canvas.getContext('2d')!;
    context.clearRect(0, 0, canvas.width, canvas.height);
    drawStrokes(context, canvas.width, canvas.height, getComputedStyle(canvas).color);
  }

  $effect(() => {
    void strokes.length;
    render();
  });

  $effect(() => {
    if (!canvas) return;
    const observer = new ResizeObserver(render);
    observer.observe(canvas);
    return () => observer.disconnect();
  });

  function pointFrom(event: PointerEvent): Point {
    const rect = canvas!.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  }

  function handlePointerDown(event: PointerEvent) {
    canvas!.setPointerCapture(event.pointerId);
    activeStroke = [pointFrom(event)];
    strokes = [...strokes, activeStroke];
  }

  function handlePointerMove(event: PointerEvent) {
    if (!activeStroke) return;
    activeStroke.push(pointFrom(event));
    render();
  }

  function handlePointerUp() {
    if (!activeStroke) return;
    activeStroke = null;
    exportSignature();
  }

  function exportSignature() {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = EXPORT_WIDTH;
    exportCanvas.height = EXPORT_HEIGHT;
    const context = exportCanvas.getContext('2d')!;
    context.fillStyle = EXPORT_PAPER;
    context.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
    drawStrokes(context, EXPORT_WIDTH, EXPORT_HEIGHT, EXPORT_INK);

    exportCanvas.toBlob(
      (blob) => {
        if (blob) signature = new File([blob], 'signature.jpg', { type: 'image/jpeg' });
      },
      'image/jpeg',
      EXPORT_QUALITY,
    );
  }

  function clear() {
    strokes = [];
    signature = null;
  }
</script>

<div class="relative overflow-hidden rounded-lg border bg-muted/30">
  <canvas
    bind:this={canvas}
    class="block aspect-[3/1] w-full cursor-crosshair touch-none text-foreground"
    aria-label="Signature pad"
    onpointerdown={handlePointerDown}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onpointercancel={handlePointerUp}
  ></canvas>

  <div class="pointer-events-none absolute inset-x-6 bottom-[22%] border-b border-dashed"></div>
  {#if !hasDrawn}
    <span
      class="pointer-events-none absolute bottom-[24%] left-6 text-sm text-muted-foreground select-none"
    >
      Sign here
    </span>
  {/if}

  {#if hasDrawn}
    <Button size="sm" variant="ghost" class="absolute top-1.5 right-1.5" onclick={clear}>
      <EraserIcon />
      Clear
    </Button>
  {/if}
</div>
