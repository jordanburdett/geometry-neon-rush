import { describe, it, expect } from 'vitest'
import { aabbCollision, spawnDeathParticles, respawnPlayer } from '../physics'
import { FLOOR_Y, PLAYER_SIZE, CHECKPOINT_X, GamePhase } from '../constants'
import type { GameState, Particle } from '../types'

// ── AABB Collision Tests ──────────────────────────────────────────────────────

describe('aabbCollision', () => {
  it('returns true when rectangles overlap exactly', () => {
    expect(aabbCollision(0, 0, 40, 40, 0, 0, 40, 40)).toBe(true)
  })

  it('returns true when player center overlaps obstacle', () => {
    // Player at (100, 200), obstacle at (110, 200) — overlapping
    expect(aabbCollision(100, 200, 40, 40, 110, 200, 40, 40)).toBe(true)
  })

  it('returns false when rectangles are side by side', () => {
    // Player at x=0, obstacle at x=40 — touching but not overlapping
    expect(aabbCollision(0, 0, 40, 40, 40, 0, 40, 40)).toBe(false)
  })

  it('returns false when fully separated horizontally', () => {
    expect(aabbCollision(0, 0, 40, 40, 100, 0, 40, 40)).toBe(false)
  })

  it('returns false when fully separated vertically', () => {
    expect(aabbCollision(0, 0, 40, 40, 0, 100, 40, 40)).toBe(false)
  })

  // Mercy shrink: player hitbox is 80% of actual size
  // At 10% inset, player pLeft = px + pw*0.1, pRight = px + pw*0.9
  it('mercy shrink — near miss on left edge does NOT register as hit', () => {
    // Player at x=100, pw=40 → pLeft = 100 + 4 = 104
    // Obstacle right edge at x=103 (ox=63, ow=40) → ox+ow = 103
    // pLeft (104) > obs right (103) → no collision
    expect(aabbCollision(100, 100, 40, 40, 63, 100, 40, 40)).toBe(false)
  })

  it('mercy shrink — full body overlap registers as hit', () => {
    // Player at x=100, obstacle at x=104 (center overlap)
    expect(aabbCollision(100, 100, 40, 40, 104, 100, 40, 40)).toBe(true)
  })

  it('mercy shrink — 10% right-side inset: near-miss on right edge', () => {
    // Player at x=100, pw=40 → pRight = 100 + 36 = 136
    // Obstacle left edge at x=137 → no collision
    expect(aabbCollision(100, 100, 40, 40, 137, 100, 40, 40)).toBe(false)
  })

  it('mercy shrink — 10% top inset: spike tip just above player top 10%', () => {
    // Player at y=400, ph=40 → pTop = 400 + 4 = 404
    // Obstacle bottom at y=403 (oy=380, oh=23) → oy+oh = 403
    // pTop (404) > obs bottom (403) → no collision
    expect(aabbCollision(100, 400, 40, 40, 100, 380, 40, 23)).toBe(false)
  })
})

// ── Particle Emitter Tests ────────────────────────────────────────────────────

describe('spawnDeathParticles', () => {
  it('spawns exactly 16 particles', () => {
    const particles: Particle[] = []
    spawnDeathParticles(100, 200, particles)
    expect(particles).toHaveLength(16)
  })

  it('particles start at approximate spawn position', () => {
    const particles: Particle[] = []
    spawnDeathParticles(100, 200, particles)
    for (const p of particles) {
      // Particles spawn at center of cube: (100 + PLAYER_SIZE/2, 200 + PLAYER_SIZE/2)
      expect(p.x).toBeCloseTo(100 + PLAYER_SIZE / 2, 0)
      expect(p.y).toBeCloseTo(200 + PLAYER_SIZE / 2, 0)
    }
  })

  it('all particles have positive max life', () => {
    const particles: Particle[] = []
    spawnDeathParticles(200, 300, particles)
    for (const p of particles) {
      expect(p.maxLife).toBeGreaterThan(0)
      expect(p.life).toBe(p.maxLife)
    }
  })

  it('particles spread in all directions (vx range)', () => {
    const particles: Particle[] = []
    spawnDeathParticles(100, 100, particles)
    const hasPositiveVx = particles.some(p => p.vx > 0)
    const hasNegativeVx = particles.some(p => p.vx < 0)
    expect(hasPositiveVx).toBe(true)
    expect(hasNegativeVx).toBe(true)
  })
})

// ── Checkpoint Respawn Tests ──────────────────────────────────────────────────

describe('respawnPlayer', () => {
  function makeState(checkpointReached: boolean): GameState {
    return {
      phase: GamePhase.DEAD,
      player: {
        worldX: 5000,
        y: FLOOR_Y - PLAYER_SIZE,
        vy: -500,
        onGround: false,
        form: 'CUBE',
        rotation: 1.5,
        trail: [{ x: 100, y: 200 }],
      },
      obstacles: [],
      particles: [],
      stars: [],
      cameraX: 4900,
      checkpointReached,
      checkpointWorldX: CHECKPOINT_X,
      shakeTimer: 0.1,
      shakeX: 5,
      shakeY: -3,
      time: 10,
      respawnTimer: 0,
      attempts: 2,
    }
  }

  it('respawns at start (worldX=0) when no checkpoint reached', () => {
    const state = makeState(false)
    respawnPlayer(state)
    expect(state.player.worldX).toBe(0)
  })

  it('respawns at checkpoint worldX when checkpoint was reached', () => {
    const state = makeState(true)
    respawnPlayer(state)
    expect(state.player.worldX).toBe(CHECKPOINT_X)
  })

  it('resets player velocity and onGround on respawn', () => {
    const state = makeState(false)
    respawnPlayer(state)
    expect(state.player.vy).toBe(0)
    expect(state.player.onGround).toBe(true)
  })

  it('clears trail on respawn', () => {
    const state = makeState(false)
    respawnPlayer(state)
    expect(state.player.trail).toHaveLength(0)
  })

  it('sets phase back to PLAYING', () => {
    const state = makeState(false)
    respawnPlayer(state)
    expect(state.phase).toBe(GamePhase.PLAYING)
  })

  it('increments attempt counter', () => {
    const state = makeState(false)
    const prevAttempts = state.attempts
    respawnPlayer(state)
    expect(state.attempts).toBe(prevAttempts + 1)
  })

  it('resets rotation to 0', () => {
    const state = makeState(true)
    respawnPlayer(state)
    expect(state.player.rotation).toBe(0)
  })

  it('places player at floor level (y = FLOOR_Y - PLAYER_SIZE)', () => {
    const state = makeState(false)
    respawnPlayer(state)
    expect(state.player.y).toBe(FLOOR_Y - PLAYER_SIZE)
  })
})
