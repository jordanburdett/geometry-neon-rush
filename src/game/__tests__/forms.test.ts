import { describe, it, expect } from 'vitest'
import {
  updateShip, updateWave, updateBall,
  toggleWaveDir, flipBallGravity,
  checkPortalCollision,
} from '../physics'
import { SHIP_THRUST, SHIP_VY_MAX, WAVE_SPEED, FLOOR_Y, PLAYER_SIZE, ObstacleKind } from '../constants'
import type { Player, Obstacle } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    worldX: 0,
    y: FLOOR_Y - PLAYER_SIZE,
    vy: 0,
    onGround: true,
    form: 'CUBE',
    rotation: 0,
    gravSign: 1,
    waveDir: 'DOWN',
    trail: [],
    ...overrides,
  }
}

function makePortal(worldX: number, targetForm: 'CUBE' | 'SHIP' | 'WAVE' | 'BALL'): Obstacle {
  return {
    kind: ObstacleKind.PORTAL,
    worldX,
    y: 100,
    w: 50,
    h: 300,
    targetForm,
  }
}

// ── SHIP form tests ───────────────────────────────────────────────────────────

describe('SHIP thrust physics', () => {
  it('vy decreases by SHIP_THRUST*dt each frame while thrust held', () => {
    const player = makePlayer({ vy: 0 })
    const dt = 0.016

    updateShip(player, dt, true)

    // vy should decrease (go negative = upward) by SHIP_THRUST * dt
    expect(player.vy).toBeCloseTo(-SHIP_THRUST * dt, 3)
  })

  it('vy increases (falls) when thrust not held', () => {
    const player = makePlayer({ vy: 0, y: FLOOR_Y / 2 }) // mid-air
    const dt = 0.016

    updateShip(player, dt, false)

    // Gravity applied, vy increases
    expect(player.vy).toBeGreaterThan(0)
  })

  it('vy clamp: never exceeds +SHIP_VY_MAX (falling)', () => {
    // Start with vy already at max, falling, no thrust
    const player = makePlayer({ vy: SHIP_VY_MAX, y: FLOOR_Y / 2 })
    const dt = 0.1 // large dt to ensure overshoot without clamp

    updateShip(player, dt, false)

    expect(player.vy).toBeLessThanOrEqual(SHIP_VY_MAX)
  })

  it('vy clamp: never drops below -SHIP_VY_MAX (thrusting up)', () => {
    // Start with vy already at negative max, thrust held
    const player = makePlayer({ vy: -SHIP_VY_MAX, y: FLOOR_Y / 2 })
    const dt = 0.1

    updateShip(player, dt, true)

    expect(player.vy).toBeGreaterThanOrEqual(-SHIP_VY_MAX)
  })
})

// ── WAVE form tests ───────────────────────────────────────────────────────────

describe('WAVE direction toggle', () => {
  it('starts DOWN: vy is +WAVE_SPEED', () => {
    const player = makePlayer({ waveDir: 'DOWN', y: FLOOR_Y / 2 })
    const dt = 0.016

    updateWave(player, dt)

    // vy set to +WAVE_SPEED during DOWN phase
    expect(player.vy).toBe(WAVE_SPEED)
  })

  it('toggleWaveDir switches UP→DOWN', () => {
    const player = makePlayer({ waveDir: 'UP' })

    toggleWaveDir(player)

    expect(player.waveDir).toBe('DOWN')
  })

  it('toggleWaveDir switches DOWN→UP', () => {
    const player = makePlayer({ waveDir: 'DOWN' })

    toggleWaveDir(player)

    expect(player.waveDir).toBe('UP')
  })

  it('alternates between -WAVE_SPEED and +WAVE_SPEED on each tap', () => {
    const player = makePlayer({ waveDir: 'DOWN', y: FLOOR_Y / 2 })
    const dt = 0.016

    // First frame: DOWN → vy = +WAVE_SPEED
    updateWave(player, dt)
    expect(player.vy).toBe(WAVE_SPEED)

    // Tap toggles to UP
    toggleWaveDir(player)
    updateWave(player, dt)
    expect(player.vy).toBe(-WAVE_SPEED)

    // Tap toggles back to DOWN
    toggleWaveDir(player)
    updateWave(player, dt)
    expect(player.vy).toBe(WAVE_SPEED)
  })
})

// ── BALL form tests ───────────────────────────────────────────────────────────

describe('BALL gravity flip', () => {
  it('gravSign starts at +1 (normal gravity)', () => {
    const player = makePlayer({ gravSign: 1 })
    expect(player.gravSign).toBe(1)
  })

  it('flipBallGravity: +1 → -1 on first tap', () => {
    const player = makePlayer({ gravSign: 1 })

    flipBallGravity(player)

    expect(player.gravSign).toBe(-1)
  })

  it('flipBallGravity: -1 → +1 on second tap', () => {
    const player = makePlayer({ gravSign: -1 })

    flipBallGravity(player)

    expect(player.gravSign).toBe(1)
  })

  it('gravSign alternates +1/-1 on each tap', () => {
    const player = makePlayer({ gravSign: 1 })

    flipBallGravity(player)
    expect(player.gravSign).toBe(-1)

    flipBallGravity(player)
    expect(player.gravSign).toBe(1)

    flipBallGravity(player)
    expect(player.gravSign).toBe(-1)
  })

  it('ball falls down when gravSign=1', () => {
    const player = makePlayer({ gravSign: 1, vy: 0, y: FLOOR_Y / 2 })
    const dt = 0.016

    updateBall(player, dt)

    // Gravity pulls down (vy increases positively)
    expect(player.vy).toBeGreaterThan(0)
  })

  it('ball falls up (toward ceiling) when gravSign=-1', () => {
    const player = makePlayer({ gravSign: -1, vy: 0, y: FLOOR_Y / 2 })
    const dt = 0.016

    updateBall(player, dt)

    // Inverted gravity pulls up (vy decreases / goes negative)
    expect(player.vy).toBeLessThan(0)
  })
})

// ── Portal collision tests ────────────────────────────────────────────────────

describe('Portal form switch', () => {
  it('returns portal index when player overlaps portal', () => {
    // Player at worldX=200, screen at 200-100=100 (cameraX=100)
    // Portal worldX=200, so obsScreenX=100 → overlaps player (playerScreenX=100)
    const player = makePlayer({ worldX: 200, y: 150 })
    const portals: Obstacle[] = [makePortal(200, 'SHIP')]
    const cameraX = 100 // player.worldX - 100

    const idx = checkPortalCollision(player, portals, cameraX)
    expect(idx).toBe(0)
  })

  it('returns -1 when player is far from portal', () => {
    const player = makePlayer({ worldX: 200, y: 150 })
    const portals: Obstacle[] = [makePortal(500, 'WAVE')]
    const cameraX = 100

    const idx = checkPortalCollision(player, portals, cameraX)
    expect(idx).toBe(-1)
  })

  it('portal targetForm is the correct form', () => {
    const player = makePlayer({ worldX: 200, y: 150 })
    const portals: Obstacle[] = [makePortal(200, 'BALL')]
    const cameraX = 100

    const idx = checkPortalCollision(player, portals, cameraX)
    expect(idx).toBe(0)
    expect(portals[0].targetForm).toBe('BALL')
  })

  it('portal re-trigger guard: same portal index does not trigger again', () => {
    // Simulate the inPortalIdx guard: if inPortalIdx === portalIdx, skip
    // This mirrors the logic in useGameEngine update()
    const inPortalIdx = 0 // already inside portal 0
    const player = makePlayer({ worldX: 200, y: 150 })
    const portals: Obstacle[] = [makePortal(200, 'SHIP')]
    const cameraX = 100

    const portalIdx = checkPortalCollision(player, portals, cameraX)
    // Guard check: same portal → should NOT re-trigger
    const shouldSwitch = portalIdx !== -1 && portalIdx !== inPortalIdx
    expect(shouldSwitch).toBe(false)
  })

  it('portal re-trigger guard: clears when player exits portal', () => {
    // Player has moved past the portal (worldX=500 far from portal at 200)
    const player = makePlayer({ worldX: 500, y: 150 })
    const portals: Obstacle[] = [makePortal(200, 'SHIP')]
    const cameraX = 400

    const portalIdx = checkPortalCollision(player, portals, cameraX)
    // Returns -1 → guard should be cleared
    expect(portalIdx).toBe(-1)
  })
})
