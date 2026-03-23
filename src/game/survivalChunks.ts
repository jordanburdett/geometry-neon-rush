// ── Survival chunk templates ──────────────────────────────────────────────────
// Each chunk is CHUNK_WIDTH (960px) wide.
// xOffset: world x where this chunk starts.
// rng: seeded or Math.random based RNG for procedural variation.

import type { ChunkTemplate } from './types'
import type { FormType } from './constants'
import { FLOOR_Y, ObstacleKind, CHUNK_WIDTH } from './constants'
import type { Obstacle } from './types'

// ── Local inline obstacle helpers (avoid import cycle with levelHelpers) ──────

function mkSpike(worldX: number, w = 36, h = 40): Obstacle {
  return { kind: ObstacleKind.SPIKE, worldX, y: FLOOR_Y - h, w, h }
}

function mkTallSpike(worldX: number, w = 30, h = 60): Obstacle {
  return { kind: ObstacleKind.SPIKE, worldX, y: FLOOR_Y - h, w, h }
}

function mkCeilSpike(worldX: number, w = 36, h = 40): Obstacle {
  return { kind: ObstacleKind.SPIKE, worldX, y: 0, w, h }
}

function mkSaw(worldX: number, y: number, r = 24): Obstacle {
  return { kind: ObstacleKind.SAW, worldX, y: y - r, w: r * 2, h: r * 2, angle: 0 }
}

function mkPlatform(worldX: number, y: number, w: number, h = 18): Obstacle {
  return { kind: ObstacleKind.PLATFORM, worldX, y, w, h }
}

function mkLaser(worldX: number): Obstacle {
  return {
    kind: ObstacleKind.LASER,
    worldX,
    y: 0,
    w: 8,
    h: FLOOR_Y,
    laserOn: true,
    laserTimer: 0,
  }
}

function mkPortal(worldX: number, targetForm: FormType): Obstacle {
  return {
    kind: ObstacleKind.PORTAL,
    worldX,
    y: FLOOR_Y - 160,
    w: 40,
    h: 160,
    targetForm,
  }
}

// ── 8 distinct chunk templates ────────────────────────────────────────────────

export const CHUNK_TEMPLATES: ChunkTemplate[] = [
  // Chunk 0: Simple spike rhythm — warm up
  {
    id: 'spike-rhythm',
    obstacles: (x, rng) => {
      const obs: Obstacle[] = []
      const base = [200, 360, 520, 700, 860]
      for (const off of base) {
        if (rng() < 0.85) obs.push(mkSpike(x + off))
      }
      return obs
    },
  },

  // Chunk 1: Saw gauntlet — series of saws at floor level
  {
    id: 'saw-gauntlet',
    obstacles: (x, rng) => {
      const obs: Obstacle[] = []
      const positions = [150, 300, 450, 600, 750]
      for (const off of positions) {
        if (rng() < 0.8) obs.push(mkSaw(x + off, FLOOR_Y))
      }
      return obs
    },
  },

  // Chunk 2: Platform jumps — elevated platforms with spikes beneath
  {
    id: 'platform-jumps',
    obstacles: (x, rng) => {
      const obs: Obstacle[] = []
      const gap = rng() > 0.5 ? 200 : 220
      obs.push(mkPlatform(x + 180, FLOOR_Y - 120, 80))
      obs.push(mkSpike(x + 180 + gap, 36, 40))
      obs.push(mkPlatform(x + 480, FLOOR_Y - 100, 80))
      obs.push(mkSpike(x + 480 + gap, 36, 40))
      obs.push(mkPlatform(x + 750, FLOOR_Y - 130, 80))
      return obs
    },
  },

  // Chunk 3: Ceiling gauntlet — ceiling spikes with floor gaps
  {
    id: 'ceiling-gauntlet',
    obstacles: (x, rng) => {
      const obs: Obstacle[] = []
      for (let i = 0; i < 5; i++) {
        const off = 150 + i * 160
        if (rng() < 0.75) obs.push(mkCeilSpike(x + off))
        if (rng() < 0.5) obs.push(mkSpike(x + off + 60))
      }
      return obs
    },
  },

  // Chunk 4: Laser crossing — intermittent laser walls
  {
    id: 'laser-crossing',
    obstacles: (x, _rng) => {
      return [
        mkLaser(x + 250),
        mkLaser(x + 500),
        mkLaser(x + 750),
      ]
    },
  },

  // Chunk 5: Mixed madness — spikes + saws + platform
  {
    id: 'mixed-madness',
    obstacles: (x, rng) => {
      const obs: Obstacle[] = []
      obs.push(mkSpike(x + 120))
      obs.push(mkSpike(x + 160))
      obs.push(mkSaw(x + 350, FLOOR_Y))
      obs.push(mkPlatform(x + 500, FLOOR_Y - 90, 60))
      obs.push(mkSaw(x + 530, FLOOR_Y - 90 + 12))
      if (rng() < 0.6) obs.push(mkTallSpike(x + 680))
      if (rng() < 0.6) obs.push(mkTallSpike(x + 720))
      obs.push(mkSpike(x + 860))
      return obs
    },
  },

  // Chunk 6: Tall spike corridor — dense tall spikes with threading gaps
  {
    id: 'tall-spike-corridor',
    obstacles: (x, rng) => {
      const obs: Obstacle[] = []
      const positions = [200, 260, 400, 460, 600, 660, 780, 840]
      for (const off of positions) {
        if (rng() < 0.8) obs.push(mkTallSpike(x + off))
      }
      return obs
    },
  },

  // Chunk 7: Form-gate portal — switches to SHIP for the next chunk
  {
    id: 'portal-ship',
    obstacles: (x, _rng) => {
      return [
        mkSpike(x + 150),
        mkSpike(x + 190),
        mkPortal(x + 400, 'SHIP'),
        mkSaw(x + 650, FLOOR_Y),
        mkSaw(x + 760, FLOOR_Y),
      ]
    },
  },

  // Chunk 8: SHIP section — fly through ceiling/floor obstacles
  {
    id: 'ship-fly',
    obstacles: (x, rng) => {
      const obs: Obstacle[] = []
      // Ceiling spikes and floor spikes to thread through
      const pairs = [200, 380, 560, 720]
      for (const off of pairs) {
        if (rng() < 0.7) obs.push(mkCeilSpike(x + off, 60, 50))
        if (rng() < 0.7) obs.push(mkSpike(x + off + 30, 60, 50))
      }
      // Return-to-cube portal at chunk end
      obs.push(mkPortal(x + 880, 'CUBE'))
      return obs
    },
  },

  // Chunk 9: Wave portal section
  {
    id: 'portal-wave',
    obstacles: (x, _rng) => {
      return [
        mkSpike(x + 100),
        mkPortal(x + 300, 'WAVE'),
        mkCeilSpike(x + 550),
        mkSpike(x + 600),
        mkCeilSpike(x + 700),
        mkPortal(x + 850, 'CUBE'),
      ]
    },
  },
]

// ── Chunk pool selector ───────────────────────────────────────────────────────
// Returns a chunk template index chosen by rng, weighted to keep variety.
// Avoids consecutive portal chunks unless difficulty is high.
export function pickChunk(
  rng: () => number,
  difficultyLevel: number,
  lastChunkId: string,
): ChunkTemplate {
  // Base pool: first 8 chunks (indices 0-7)
  // At difficulty 3+, include portal chunks (8-9)
  const poolEnd = difficultyLevel >= 3 ? CHUNK_TEMPLATES.length : 8
  const pool = CHUNK_TEMPLATES.slice(0, poolEnd)

  // Filter out consecutive portal chunks
  const filtered = pool.filter(c => {
    if (lastChunkId.startsWith('portal') || lastChunkId === 'ship-fly') {
      return !c.id.startsWith('portal') && c.id !== 'ship-fly'
    }
    return true
  })

  const candidates = filtered.length > 0 ? filtered : pool
  const idx = Math.floor(rng() * candidates.length)
  return candidates[idx]
}

// ── Extra obstacle injection for difficulty scaling ───────────────────────────
// At higher difficulty levels, inject extra obstacles into chunks.
export function injectDifficultyObstacles(
  obstacles: Obstacle[],
  xOffset: number,
  difficultyLevel: number,
  rng: () => number,
): Obstacle[] {
  if (difficultyLevel < 1) return obstacles
  const extra: Obstacle[] = []
  const count = Math.min(difficultyLevel, 3)
  const positions = [280, 460, 640, 800]
  for (let i = 0; i < count; i++) {
    const pos = positions[i % positions.length]
    // Only add if nothing is too close (simple check)
    const nearbyExists = obstacles.some(o => Math.abs(o.worldX - (xOffset + pos)) < 60)
    if (!nearbyExists) {
      if (rng() < 0.5) {
        extra.push(mkSpike(xOffset + pos))
      } else {
        extra.push(mkSaw(xOffset + pos, FLOOR_Y))
      }
    }
  }
  return [...obstacles, ...extra]
}

// ── Compute chunk boundary world X values ────────────────────────────────────
/** Returns the worldX where chunk N starts (0-indexed) */
export function chunkStartX(index: number): number {
  return index * CHUNK_WIDTH
}
