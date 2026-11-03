import { describe, expect, it } from 'vitest';
import { decidePod, MAX_RETAKES } from '@/lib/pod-rules';
import type { Extraction } from '@/lib/types';

const trip = { lr_no: 'LR-CH66150', qty: 500 };
const good: Extraction = {
  lr_number: 'LR-CH66150', consignee_stamp: true, quantity: 500, remarks: null, shortage_or_damage: false,
  delivery_date: '2026-11-03', signature: true, image_quality: 'ok', confidence: 0.93,
};

describe('decidePod', () => {
  it('verifies a clean POD', () => {
    expect(decidePod(good, trip, 0)).toEqual({ decision: 'verified', reasons: [] });
  });
  it('ignores LR formatting differences', () => {
    expect(decidePod({ ...good, lr_number: 'lr ch 66150' }, trip, 0).decision).toBe('verified');
  });
  it('asks for a retake when the stamp is missing', () => {
    const r = decidePod({ ...good, consignee_stamp: false }, trip, 0);
    expect(r.decision).toBe('retake');
    expect(r.reasons).toContain('stamp_missing');
  });
  it('asks for a retake for blurry, dark or cropped photos', () => {
    for (const q of ['blurry', 'dark', 'cropped'] as const) {
      expect(decidePod({ ...good, image_quality: q }, trip, 0).decision).toBe('retake');
    }
  });
  it('asks for a retake when the LR number is wrong or unreadable', () => {
    expect(decidePod({ ...good, lr_number: 'LR-XX99999' }, trip, 0).reasons).toContain('lr_mismatch');
    expect(decidePod({ ...good, lr_number: null }, trip, 0).reasons).toContain('lr_missing');
  });
  it('caps retakes at two, then hands to a person', () => {
    expect(decidePod({ ...good, consignee_stamp: false }, trip, MAX_RETAKES - 1).decision).toBe('retake');
    const r = decidePod({ ...good, consignee_stamp: false }, trip, MAX_RETAKES);
    expect(r.decision).toBe('needs_review');
    expect(r.reasons).toContain('retake_cap');
  });
  it('sends shortage or damage to a person, even if the photo is also poor', () => {
    expect(decidePod({ ...good, shortage_or_damage: true, quantity: 494 }, trip, 0).decision).toBe('needs_review');
    expect(decidePod({ ...good, shortage_or_damage: true, consignee_stamp: false }, trip, 0).decision).toBe('needs_review');
  });
  it('sends low confidence to a person even when every field looks fine', () => {
    const r = decidePod({ ...good, confidence: 0.6 }, trip, 0);
    expect(r.decision).toBe('needs_review');
    expect(r.reasons).toContain('low_confidence');
  });
  it('sends quantity mismatch or unreadable quantity to a person', () => {
    expect(decidePod({ ...good, quantity: 490 }, trip, 0).reasons).toContain('qty_mismatch');
    expect(decidePod({ ...good, quantity: null }, trip, 0).reasons).toContain('qty_missing');
  });
  it('never returns verified when confidence is exactly below the threshold', () => {
    expect(decidePod({ ...good, confidence: 0.749 }, trip, 0).decision).not.toBe('verified');
    expect(decidePod({ ...good, confidence: 0.75 }, trip, 0).decision).toBe('verified');
  });
});
