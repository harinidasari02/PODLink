import { describe, expect, it } from 'vitest';
import { FIRST_STEP, MIN_DIM, nextStep, TARGET_BYTES } from '@/lib/compress';

describe('compression planning', () => {
  it('stops when the image is small enough', () => expect(nextStep(FIRST_STEP, TARGET_BYTES)).toBeNull());
  it('lowers quality first, then dimensions', () => {
    const a = nextStep(FIRST_STEP, 900_000)!;
    expect(a.maxDim).toBe(1600);
    expect(a.quality).toBeLessThan(FIRST_STEP.quality);
    const b = nextStep({ maxDim: 1600, quality: 0.5 }, 900_000)!;
    expect(b.maxDim).toBeLessThan(1600);
    expect(b.quality).toBe(0.7);
  });
  it('always terminates, never below the minimum size', () => {
    let s: ReturnType<typeof nextStep> = FIRST_STEP;
    let n = 0;
    let last = FIRST_STEP;
    while (s && n++ < 100) { last = s; s = nextStep(s, 10_000_000); }
    expect(n).toBeLessThan(100);
    expect(last.maxDim).toBeGreaterThanOrEqual(MIN_DIM);
  });
});
