import sharp from 'sharp';

export const MAX_IMAGE_BYTES = 300 * 1024; // brief: compressed under 300 KB
const SERVER_TOLERANCE = 1.15; // allow a small overshoot from client compression
export const SERVER_MAX_BYTES = Math.floor(MAX_IMAGE_BYTES * SERVER_TOLERANCE);

/** Verify real image type from magic bytes (never trust the client's content-type). */
export function sniffImageType(buf: Buffer): 'jpeg' | 'png' | 'webp' | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

export interface QualityReport {
  quality: 'ok' | 'blurry' | 'dark' | 'cropped';
  sharpness: number;
  brightness: number;
}

/**
 * Cheap, local, deterministic photo-quality check. It runs before (and independently of) the
 * vision model so that a blurry or dark photo is always caught while the driver is at the gate.
 *  - brightness: mean luma 0..255
 *  - sharpness: variance of a Laplacian-like filter on a downscaled grayscale copy
 */
export async function assessQuality(buf: Buffer): Promise<QualityReport> {
  const { data, info } = await sharp(buf)
    .rotate()
    .resize({ width: 640, withoutEnlargement: true })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  const brightness = sum / data.length;

  let acc = 0, accSq = 0, n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = 4 * data[i] - data[i - 1] - data[i + 1] - data[i - w] - data[i + w];
      acc += lap; accSq += lap * lap; n++;
    }
  }
  const mean = acc / n;
  const sharpness = accSq / n - mean * mean;

  let quality: QualityReport['quality'] = 'ok';
  if (brightness < 45) quality = 'dark';
  else if (sharpness < 60) quality = 'blurry';
  return { quality, sharpness: Math.round(sharpness), brightness: Math.round(brightness) };
}
