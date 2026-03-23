// ── mulberry32 PRNG ───────────────────────────────────────────────────────────
// Deterministic seeded pseudo-random number generator.
// Returns a function that produces floats in [0, 1).

export function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return function () {
    s |= 0; s = s + 0x6D2B79F5 | 0
    let t = Math.imul(s ^ s >>> 15, 1 | s)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

// ── Daily seed calculation ────────────────────────────────────────────────────
// Produces a consistent integer from the local calendar date.
// Same date → same seed → same procedural run worldwide (for same timezone).
export function dailySeed(): number {
  const d = new Date()
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
}
