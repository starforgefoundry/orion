<script lang="ts">
  import { BarqodeStream, type DetectedBarcode } from 'barqode';

  let loading = $state(true);
  let result: DetectedBarcode[] = $state([]);

  function onCameraOn() {
    loading = false;
  }

  function onDetect(detectedCodes: DetectedBarcode[]) {
    result = detectedCodes;
  }

  function track(detectedCodes: DetectedBarcode[], ctx: CanvasRenderingContext2D) {
    for (const detectedCode of detectedCodes) {
      const [firstPoint, ...otherPoints] = detectedCode.cornerPoints;

      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(firstPoint.x, firstPoint.y);

      for (const { x, y } of otherPoints) {
        ctx.lineTo(x, y);
      }

      ctx.lineTo(firstPoint.x, firstPoint.y);
      ctx.closePath();
      ctx.stroke();
    }
  }
</script>

<div style="width: 50%; aspect-ratio: 4/3;">
  <BarqodeStream {onCameraOn} {onDetect} {track}>
    {#if loading}
      <div class="loading-indicator">Loading...</div>
    {/if}
  </BarqodeStream>
</div>

Last detected: {result.map((code) => code.rawValue).join(', ')}
