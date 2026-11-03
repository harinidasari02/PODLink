import sharp from 'sharp';
import { z } from 'zod';
import type { Extraction } from './types';
import type { QualityReport } from './image-checks';

export interface AiTrip {
  lr_no: string; qty: number; delivered_on: string | null;
  demo_scenario: string; consignee_name: string; unit: string;
}

export type AiMode = 'vision' | 'mock';

const ExtractionSchema = z.object({
  lr_number: z.string().max(40).nullable(),
  consignee_stamp: z.boolean(),
  quantity: z.number().finite().nullable(),
  remarks: z.string().max(300).nullable(),
  shortage_or_damage: z.boolean(),
  delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  signature: z.boolean(),
  image_quality: z.enum(['ok', 'blurry', 'dark', 'cropped']),
  confidence: z.number().min(0).max(1),
});

export function aiMode(): AiMode {
  return process.env.ANTHROPIC_API_KEY ? 'vision' : 'mock';
}

const PROMPT = `You are checking a photo of a signed Indian lorry receipt / proof of delivery taken at the consignee's gate.
Read ONLY what is visibly on the paper. Do not guess. If a field is not visible or not legible, use null (or false for booleans).
Return a single JSON object, no prose, with exactly these keys:
{"lr_number": string|null, "consignee_stamp": boolean, "quantity": number|null, "remarks": string|null,
 "shortage_or_damage": boolean, "delivery_date": "YYYY-MM-DD"|null, "signature": boolean,
 "image_quality": "ok"|"blurry"|"dark"|"cropped", "confidence": number between 0 and 1}
- consignee_stamp: true only if a receiving stamp/seal of the consignee is clearly visible.
- signature: true only if a handwritten signature is visible near the receiving section.
- remarks: copy any handwritten remark about shortage, damage, leakage or breakage; null if none.
- shortage_or_damage: true if a remark says goods were short, damaged, leaked, broken, wet or rejected.
- confidence: your overall confidence that the fields above are correct (be conservative).`;

async function visionExtract(buf: Buffer): Promise<Extraction> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'claude-sonnet-5-5',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: buf.toString('base64') } },
            { type: 'text', text: PROMPT },
          ],
        }],
      }),
    });
    if (!res.ok) throw new Error(`AI HTTP ${res.status}`);
    const body = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = body.content?.find((c) => c.type === 'text')?.text ?? '';
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    return ExtractionSchema.parse(JSON.parse(json));
  } finally {
    clearTimeout(timer);
  }
}

/**
 * DEMO MODE (no API key). It cannot read text, so it is honest about what it does:
 *  - stamp / signature: detected from ink colour (blue-ink pixels) on the real photo
 *  - everything else: taken from the trip's seeded scenario, as if the model had read the paper
 * The UI labels results from this mode as "demo check".
 */
export async function inkPresence(buf: Buffer): Promise<{ stamp: boolean; signature: boolean }> {
  const { data, info } = await sharp(buf).rotate().resize({ width: 480, withoutEnlargement: true }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = info.width * info.height;
  let stampPx = 0, darkInkPx = 0;
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (b > r + 50 && b > g + 25 && b > 110) stampPx++;          // medium blue stamp ink
    else if (b > r + 25 && b > g + 10 && r < 70 && g < 80) darkInkPx++; // dark blue pen
  }
  return { stamp: stampPx / px > 0.004, signature: darkInkPx / px > 0.0007 };
}

async function mockExtract(buf: Buffer, trip: AiTrip): Promise<Extraction> {
  const ink = await inkPresence(buf);
  let quantity = trip.qty;
  let remarks: string | null = null;
  let shortage = false;
  let confidence = 0.92;
  switch (trip.demo_scenario) {
    case 'shortage': quantity = trip.qty - 6; remarks = 'Short by 6 (demo)'; shortage = true; break;
    case 'qtymismatch': quantity = trip.qty - 10; break;
    case 'lowconf': confidence = 0.62; break;
  }
  return {
    lr_number: trip.lr_no, // demo mode assumes the right paper
    consignee_stamp: ink.stamp,
    quantity,
    remarks,
    shortage_or_damage: shortage,
    delivery_date: trip.delivered_on ?? new Date().toISOString().slice(0, 10),
    signature: ink.signature,
    image_quality: 'ok',
    confidence,
  };
}

export async function extractPod(
  buf: Buffer, trip: AiTrip, quality: QualityReport,
): Promise<{ mode: AiMode; extraction: Extraction }> {
  const mode = aiMode();
  let ex = mode === 'vision' ? await visionExtract(buf) : await mockExtract(buf, trip);
  // The local quality check is deterministic, so it overrides the model when it finds a problem.
  if (quality.quality !== 'ok') ex = { ...ex, image_quality: quality.quality };
  return { mode, extraction: ex };
}
