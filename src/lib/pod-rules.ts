import type { DecisionResult, Extraction, TripFacts } from './types';

export const MAX_RETAKES = 2;
export const MIN_CONFIDENCE = 0.75;

/** Human-readable text for each reason code (billing screens). */
export const REASON_TEXT: Record<string, string> = {
  quality_blurry: 'Photo is blurry',
  quality_dark: 'Photo is too dark',
  quality_cropped: 'Part of the paper is cut off',
  lr_missing: 'LR number not readable',
  lr_mismatch: 'LR number does not match this trip',
  stamp_missing: 'Consignee stamp not visible',
  signature_missing: 'Signature not visible',
  date_missing: 'Delivery date not readable',
  shortage_or_damage: 'Shortage or damage remark on the paper',
  qty_mismatch: 'Quantity differs from the trip record',
  qty_missing: 'Quantity not readable',
  low_confidence: 'AI is not confident about this reading',
  retake_cap: 'Retake limit reached, sent to a person',
  ai_unavailable: 'AI check failed, sent to a person',
};

/** Reasons the driver can fix by taking another photo. */
const RETAKEABLE = new Set([
  'quality_blurry', 'quality_dark', 'quality_cropped',
  'lr_missing', 'lr_mismatch', 'stamp_missing', 'signature_missing', 'date_missing',
]);

export function normaliseLr(s: string | null | undefined): string {
  return (s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Pure decision function. The AI never approves an invoice; at best it marks a POD
 * "verified", which only places the trip in the billing queue for a person to invoice.
 *
 * Order of precedence:
 *  1. A shortage/damage remark always goes to a person (it is a commercial dispute risk).
 *  2. Problems the driver can fix at the gate -> ask for a retake (max 2).
 *  3. Anything else uncertain -> a person.
 */
export function decidePod(
  ex: Extraction,
  trip: TripFacts,
  retakesUsed: number,
): DecisionResult {
  const fixable: string[] = [];
  const review: string[] = [];

  if (ex.image_quality === 'blurry') fixable.push('quality_blurry');
  if (ex.image_quality === 'dark') fixable.push('quality_dark');
  if (ex.image_quality === 'cropped') fixable.push('quality_cropped');

  if (!ex.lr_number) fixable.push('lr_missing');
  else if (normaliseLr(ex.lr_number) !== normaliseLr(trip.lr_no)) fixable.push('lr_mismatch');

  if (!ex.consignee_stamp) fixable.push('stamp_missing');
  if (!ex.signature) fixable.push('signature_missing');
  if (!ex.delivery_date) fixable.push('date_missing');

  if (ex.shortage_or_damage) review.push('shortage_or_damage');
  if (ex.quantity == null) review.push('qty_missing');
  else if (ex.quantity !== trip.qty) review.push('qty_mismatch');
  if (ex.confidence < MIN_CONFIDENCE) review.push('low_confidence');

  // 1. shortage/damage is always a person's call, even if the photo is also poor
  if (ex.shortage_or_damage) {
    return { decision: 'needs_review', reasons: [...review, ...fixable] };
  }

  // 2. fixable at the gate
  if (fixable.length > 0) {
    if (retakesUsed < MAX_RETAKES) return { decision: 'retake', reasons: fixable };
    return { decision: 'needs_review', reasons: [...fixable, 'retake_cap', ...review] };
  }

  // 3. uncertain or mismatched
  if (review.length > 0) return { decision: 'needs_review', reasons: review };

  return { decision: 'verified', reasons: [] };
}

export function isRetakeableReason(code: string): boolean {
  return RETAKEABLE.has(code);
}

/** Result when the AI call itself fails: never block the driver, never auto-approve. */
export function aiUnavailableResult(): DecisionResult {
  return { decision: 'needs_review', reasons: ['ai_unavailable'] };
}
