import { describe, it, expect } from 'vitest';
import { seededRandom, randomCrowd } from '../src/lib/sprites/character';

describe('seededRandom', () => {
  it('同一個種子產生同一串數字', () => {
    const a = seededRandom(42), b = seededRandom(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('數值落在 [0, 1)', () => {
    const r = seededRandom(7);
    for (let i = 0; i < 1000; i++) { const x = r(); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); }
  });
  it('群眾角色可重現', () => {
    expect(randomCrowd(10, 2026)).toEqual(randomCrowd(10, 2026));
  });
});
