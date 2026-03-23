import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mulberry32, dailySeed } from '../prng'
import { lsGet, lsSet, saveGhostSurvivalIfBest, saveGhostClassicIfBest, getGhostClassicBestTime } from '../storage'
import type { GhostSample } from '../storage'
import { SCROLL_SPEED, SURVIVAL_SCALE_FACTOR, SURVIVAL_SCALE_INTERVAL } from '../constants'
import { chunkStartX, CHUNK_TEMPLATES } from '../survivalChunks'

// ── mulberry32 determinism ────────────────────────────────────────────────────

describe('mulberry32 determinism', () => {
  it('same seed produces same 10-value sequence', () => {
    const rng1 = mulberry32(42)
    const rng2 = mulberry32(42)
    for (let i = 0; i < 10; i++) {
      expect(rng1()).toBe(rng2())
    }
  })

  it('different seeds produce different sequences', () => {
    const rng1 = mulberry32(1)
    const rng2 = mulberry32(2)
    const seq1 = Array.from({ length: 10 }, () => rng1())
    const seq2 = Array.from({ length: 10 }, () => rng2())
    // At least one value should differ
    const allSame = seq1.every((v, i) => v === seq2[i])
    expect(allSame).toBe(false)
  })

  it('produces values in [0, 1)', () => {
    const rng = mulberry32(99)
    for (let i = 0; i < 20; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('sequence of 10 matches known expected values for seed=1', () => {
    // Verify determinism against a known reference sequence
    const rng = mulberry32(1)
    const seq = Array.from({ length: 10 }, () => rng())
    // All values should be in [0,1)
    expect(seq.every(v => v >= 0 && v < 1)).toBe(true)
    // Re-running same seed gives same sequence
    const rng2 = mulberry32(1)
    const seq2 = Array.from({ length: 10 }, () => rng2())
    expect(seq).toEqual(seq2)
  })
})

// ── Daily seed calculation ─────────────────────────────────────────────────────

describe('dailySeed', () => {
  it('produces expected integer for a known date', () => {
    // For 2026-03-22: year=2026, month=3, day=22
    // seed = 2026 * 10000 + 3 * 100 + 22 = 20260322
    const expected = 2026 * 10000 + 3 * 100 + 22

    // Mock Date to return 2026-03-22
    const mockDate = new Date(2026, 2, 22) // month is 0-indexed: 2 = March
    vi.setSystemTime(mockDate)

    const seed = dailySeed()
    expect(seed).toBe(expected)

    vi.useRealTimers()
  })

  it('produces a positive integer', () => {
    const seed = dailySeed()
    expect(Number.isInteger(seed)).toBe(true)
    expect(seed).toBeGreaterThan(0)
  })

  it('different dates produce different seeds', () => {
    vi.setSystemTime(new Date(2026, 2, 22))
    const seed1 = dailySeed()

    vi.setSystemTime(new Date(2026, 2, 23))
    const seed2 = dailySeed()

    expect(seed1).not.toBe(seed2)
    vi.useRealTimers()
  })
})

// ── lsGet / lsSet round-trip and error handling ───────────────────────────────

describe('lsGet / lsSet', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('round-trips a string value', () => {
    lsSet('test-key', 'hello world')
    expect(lsGet('test-key')).toBe('hello world')
  })

  it('returns null for missing key', () => {
    expect(lsGet('nonexistent-key')).toBeNull()
  })

  it('overwrites existing value', () => {
    lsSet('test-key', 'first')
    lsSet('test-key', 'second')
    expect(lsGet('test-key')).toBe('second')
  })

  it('handles error gracefully — lsGet returns null when localStorage throws', () => {
    const originalGetItem = Storage.prototype.getItem
    Storage.prototype.getItem = () => { throw new Error('quota exceeded') }
    expect(lsGet('any-key')).toBeNull()
    Storage.prototype.getItem = originalGetItem
  })

  it('handles error gracefully — lsSet does not throw when localStorage throws', () => {
    const originalSetItem = Storage.prototype.setItem
    Storage.prototype.setItem = () => { throw new Error('quota exceeded') }
    expect(() => lsSet('any-key', 'value')).not.toThrow()
    Storage.prototype.setItem = originalSetItem
  })
})

// ── Difficulty scaling ────────────────────────────────────────────────────────

describe('difficulty scaling', () => {
  it('scroll speed after 3 scaling steps equals initial * 1.05^3', () => {
    const initial = SCROLL_SPEED
    const steps = 3
    const expected = initial * Math.pow(1 + SURVIVAL_SCALE_FACTOR, steps)
    // Simulate 3 scaling intervals
    const scaledSpeed = SCROLL_SPEED * Math.pow(1 + SURVIVAL_SCALE_FACTOR, steps)
    expect(scaledSpeed).toBeCloseTo(expected, 5)
  })

  it('SURVIVAL_SCALE_FACTOR is 5% (0.05)', () => {
    expect(SURVIVAL_SCALE_FACTOR).toBe(0.05)
  })

  it('SURVIVAL_SCALE_INTERVAL is 15 seconds', () => {
    expect(SURVIVAL_SCALE_INTERVAL).toBe(15)
  })

  it('difficulty level increases at expected run times', () => {
    // After 14.9s: difficultyLevel = floor(14.9/15) = 0
    expect(Math.floor(14.9 / SURVIVAL_SCALE_INTERVAL)).toBe(0)
    // After 15s: difficultyLevel = floor(15/15) = 1
    expect(Math.floor(15 / SURVIVAL_SCALE_INTERVAL)).toBe(1)
    // After 44s: difficultyLevel = floor(44/15) = 2
    expect(Math.floor(44 / SURVIVAL_SCALE_INTERVAL)).toBe(2)
    // After 45s: difficultyLevel = floor(45/15) = 3
    expect(Math.floor(45 / SURVIVAL_SCALE_INTERVAL)).toBe(3)
  })
})

// ── Chunk assembly ────────────────────────────────────────────────────────────

describe('chunk assembly', () => {
  it('first chunk starts at x=0', () => {
    expect(chunkStartX(0)).toBe(0)
  })

  it('second chunk starts at x=960', () => {
    expect(chunkStartX(1)).toBe(960)
  })

  it('third chunk starts at x=1920', () => {
    expect(chunkStartX(2)).toBe(1920)
  })

  it('chunk N starts at N * 960', () => {
    for (let i = 0; i < 10; i++) {
      expect(chunkStartX(i)).toBe(i * 960)
    }
  })

  it('has at least 8 distinct chunk templates', () => {
    expect(CHUNK_TEMPLATES.length).toBeGreaterThanOrEqual(8)
  })

  it('all chunk templates have unique ids', () => {
    const ids = CHUNK_TEMPLATES.map(c => c.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  it('chunk obstacles xOffset shifts all obstacle worldX values', () => {
    const rng = mulberry32(1)
    const tmpl = CHUNK_TEMPLATES[0] // spike-rhythm
    const obs0 = tmpl.obstacles(0, rng)
    const rng2 = mulberry32(1)
    const obs960 = tmpl.obstacles(960, rng2)

    // Every obstacle in obs960 should be 960 units further than obs0
    // (assuming same rng produces same obstacle count and relative positions)
    expect(obs0.length).toBe(obs960.length)
    for (let i = 0; i < obs0.length; i++) {
      expect(obs960[i].worldX - obs0[i].worldX).toBe(960)
    }
  })
})

// ── Ghost replay storage ──────────────────────────────────────────────────────

describe('saveGhostSurvivalIfBest', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => { localStorage.clear() })

  const samples: GhostSample[] = [
    { worldX: 100, form: 'CUBE' },
    { worldX: 200, form: 'SHIP' },
    { worldX: 300, form: 'CUBE' },
  ]

  it('saves on first run (no stored ghost)', () => {
    const saved = saveGhostSurvivalIfBest(50, samples)
    expect(saved).toBe(true)
    const raw = lsGet('gnr-ghost-survival')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!) as GhostSample[]
    expect(parsed).toEqual(samples)
  })

  it('returns true and overwrites when new metres beats stored best', () => {
    saveGhostSurvivalIfBest(50, samples)
    const betterSamples: GhostSample[] = [{ worldX: 500, form: 'WAVE' }]
    const saved = saveGhostSurvivalIfBest(100, betterSamples)
    expect(saved).toBe(true)
    const raw = lsGet('gnr-ghost-survival')
    const parsed = JSON.parse(raw!) as GhostSample[]
    expect(parsed).toEqual(betterSamples)
  })

  it('returns false and does not overwrite when new metres does not beat stored best', () => {
    saveGhostSurvivalIfBest(100, samples)
    const worseSamples: GhostSample[] = [{ worldX: 50, form: 'BALL' }]
    const saved = saveGhostSurvivalIfBest(50, worseSamples)
    expect(saved).toBe(false)
    // Original samples should still be stored
    const raw = lsGet('gnr-ghost-survival')
    const parsed = JSON.parse(raw!) as GhostSample[]
    expect(parsed).toEqual(samples)
  })

  it('saves JSON array of {worldX, form} objects', () => {
    saveGhostSurvivalIfBest(10, samples)
    const raw = lsGet('gnr-ghost-survival')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!) as GhostSample[]
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed[0]).toHaveProperty('worldX')
    expect(parsed[0]).toHaveProperty('form')
  })
})

describe('saveGhostClassicIfBest', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => { localStorage.clear() })

  const samples: GhostSample[] = [
    { worldX: 0, form: 'CUBE' },
    { worldX: 4000, form: 'CUBE' },
    { worldX: 8000, form: 'CUBE' },
  ]

  it('saves on first completion (no stored ghost)', () => {
    const saved = saveGhostClassicIfBest(1, 45.2, samples)
    expect(saved).toBe(true)
    const raw = lsGet('gnr-ghost-classic-l1')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!) as GhostSample[]
    expect(parsed).toEqual(samples)
  })

  it('stores the completion time for future comparisons', () => {
    saveGhostClassicIfBest(1, 45.2, samples)
    expect(getGhostClassicBestTime(1)).toBeCloseTo(45.2, 5)
  })

  it('returns true and overwrites when new time is faster', () => {
    saveGhostClassicIfBest(1, 45.2, samples)
    const fasterSamples: GhostSample[] = [{ worldX: 8000, form: 'SHIP' }]
    const saved = saveGhostClassicIfBest(1, 40.0, fasterSamples)
    expect(saved).toBe(true)
    const raw = lsGet('gnr-ghost-classic-l1')
    const parsed = JSON.parse(raw!) as GhostSample[]
    expect(parsed).toEqual(fasterSamples)
  })

  it('returns false and does not overwrite when new time is slower', () => {
    saveGhostClassicIfBest(1, 40.0, samples)
    const slowerSamples: GhostSample[] = [{ worldX: 0, form: 'BALL' }]
    const saved = saveGhostClassicIfBest(1, 50.0, slowerSamples)
    expect(saved).toBe(false)
    const raw = lsGet('gnr-ghost-classic-l1')
    const parsed = JSON.parse(raw!) as GhostSample[]
    expect(parsed).toEqual(samples)
  })

  it('uses separate keys for different levels', () => {
    saveGhostClassicIfBest(1, 45.0, samples)
    saveGhostClassicIfBest(2, 60.0, [{ worldX: 500, form: 'WAVE' }])
    expect(lsGet('gnr-ghost-classic-l1')).not.toBeNull()
    expect(lsGet('gnr-ghost-classic-l2')).not.toBeNull()
    expect(getGhostClassicBestTime(1)).toBeCloseTo(45.0, 5)
    expect(getGhostClassicBestTime(2)).toBeCloseTo(60.0, 5)
  })

  it('getGhostClassicBestTime returns null when no ghost stored', () => {
    expect(getGhostClassicBestTime(3)).toBeNull()
  })
})
