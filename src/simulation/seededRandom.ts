// Deterministic PRNG (mulberry32) so runs are repeatable for fair
// Baseline vs ALIEN X comparison given the same seed.

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randRange(rand: () => number, min: number, max: number): number {
  return min + rand() * (max - min);
}

export function randInt(rand: () => number, min: number, max: number): number {
  return Math.floor(randRange(rand, min, max + 1));
}

export function makeSeed(): number {
  return Math.floor(Math.random() * 1_000_000_000);
}
