// Browser-side image compression. Pure planning logic is separate so it can be unit tested.
export const TARGET_BYTES = 290 * 1024; // headroom under the 300 KB limit
export const MIN_DIM = 640;

export interface Step { maxDim: number; quality: number }
export const FIRST_STEP: Step = { maxDim: 1600, quality: 0.8 };

/** Next (smaller) compression step, or null when we cannot shrink any further. */
export function nextStep(prev: Step, size: number): Step | null {
  if (size <= TARGET_BYTES) return null;
  if (prev.quality > 0.5) return { maxDim: prev.maxDim, quality: Math.round((prev.quality - 0.1) * 100) / 100 };
  const maxDim = Math.round(prev.maxDim * 0.85);
  if (maxDim < MIN_DIM) return null;
  return { maxDim, quality: 0.7 };
}

async function loadBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* fall through */ }
  }
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read photo'));
    img.src = URL.createObjectURL(file);
  });
}

function toBlob(c: HTMLCanvasElement, q: number): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Compress failed'))), 'image/jpeg', q));
}

/** Resize, burn a trip/time/GPS stamp into the picture, and compress under 300 KB. */
export async function compressWithStamp(file: Blob, stamp: string): Promise<Blob> {
  const bmp = await loadBitmap(file);
  const sw = 'width' in bmp ? bmp.width : 0, sh = 'height' in bmp ? bmp.height : 0;
  let step: Step | null = FIRST_STEP;
  let best: Blob | null = null;
  while (step) {
    const scale = Math.min(1, step.maxDim / Math.max(sw, sh));
    const w = Math.round(sw * scale), h = Math.round(sh * scale);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(bmp, 0, 0, w, h);
    const fs = Math.max(14, Math.round(w / 42));
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(0, h - fs * 1.9, w, fs * 1.9);
    ctx.fillStyle = '#fff';
    ctx.font = `600 ${fs}px sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(stamp, fs * 0.6, h - fs * 0.95, w - fs * 1.2);
    best = await toBlob(c, step.quality);
    step = nextStep(step, best.size);
  }
  return best!;
}
