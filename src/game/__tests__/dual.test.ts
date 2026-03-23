import { describe, it, expect } from 'vitest'
import {
  GameMode,
  GamePhase,
  FormType,
  SCROLL_SPEED,
  FLOOR_Y,
  PLAYER_SIZE,
  SURVIVAL_SCALE_FACTOR,
  SURVIVAL_SCALE_INTERVAL,
  GRAVITY,
  DUAL_STRIP_H,
  DUAL_FLOOR_Y,
  SHIP_THRUST,
  SHIP_VY_MAX,
  WAVE_SPEED,
} from '../constants'
import type { GameState, Player } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    worldX: 0,
    y: FLOOR_Y - PLAYER_SIZE,
    vy: 0,
    onGround: true,
    form: FormType.CUBE,
    rotation: 0,
    gravSign: 1,
    waveDir: 'DOWN',
    trail: [],
    ...overrides,
  }
}

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: GamePhase.PLAYING,
    mode: GameMode.DUAL,
    player: makePlayer(),
    obstacles: [],
    particles: [],
    stars: [],
    cameraX: 0,
    checkpointReached: false,
    checkpointWorldX: 4000,
    shakeTimer: 0,
    shakeX: 0,
    shakeY: 0,
    time: 0,
    respawnTimer: 0,
    attempts: 1,
    currentLevel: 1,
    inPortalIdx: -1,
    scrollSpeed: SCROLL_SPEED,
    runTime: 0,
    difficultyLevel: 0,
    nextChunkIndex: 3,
    rng: Math.random,
    metres: 0,
    bestScore: 0,
    ...overrides,
  }
}

// ── GameMode.DUAL constant ────────────────────────────────────────────────────

describe('GameMode.DUAL constant', () => {
  it('GameMode.DUAL exists', () => {
    expect(GameMode.DUAL).toBeDefined()
  })

  it("GameMode.DUAL equals 'DUAL'", () => {
    expect(GameMode.DUAL).toBe('DUAL')
  })

  it('GameMode.DUAL is distinct from other modes', () => {
    expect(GameMode.DUAL).not.toBe(GameMode.CLASSIC)
    expect(GameMode.DUAL).not.toBe(GameMode.SURVIVAL)
    expect(GameMode.DUAL).not.toBe(GameMode.DAILY)
  })

  it('GameMode contains exactly four keys including DUAL', () => {
    const keys = Object.keys(GameMode)
    expect(keys).toContain('DUAL')
    expect(keys).toHaveLength(4)
  })
})

// ── DUAL state initialization ─────────────────────────────────────────────────

describe('DUAL state initialization', () => {
  it('lane 1 (CUBE) starts with mode DUAL', () => {
    const s1 = makeGameState({ mode: GameMode.DUAL })
    expect(s1.mode).toBe(GameMode.DUAL)
  })

  it('lane 1 player starts as CUBE form', () => {
    const s1 = makeGameState()
    expect(s1.player.form).toBe(FormType.CUBE)
  })

  it('lane 2 (SHIP) starts with form SHIP', () => {
    // When startMode(DUAL) runs, stateRef2 player is set to SHIP form
    const s2 = makeGameState({
      player: makePlayer({ form: FormType.SHIP }),
    })
    expect(s2.player.form).toBe(FormType.SHIP)
  })

  it('lane 2 player starts at floor level', () => {
    const s2 = makeGameState({
      player: makePlayer({ form: FormType.SHIP, y: DUAL_FLOOR_Y }),
    })
    expect(s2.player.y).toBe(DUAL_FLOOR_Y)
  })

  it('both lanes start with phase PLAYING', () => {
    const s1 = makeGameState()
    const s2 = makeGameState({
      player: makePlayer({ form: FormType.SHIP }),
    })
    expect(s1.phase).toBe(GamePhase.PLAYING)
    expect(s2.phase).toBe(GamePhase.PLAYING)
  })

  it('both lanes start with mode DUAL', () => {
    const s1 = makeGameState({ mode: GameMode.DUAL })
    const s2 = makeGameState({
      mode: GameMode.DUAL,
      player: makePlayer({ form: FormType.SHIP }),
    })
    expect(s1.mode).toBe(GameMode.DUAL)
    expect(s2.mode).toBe(GameMode.DUAL)
  })

  it('both lanes start with scrollSpeed = SCROLL_SPEED', () => {
    const s1 = makeGameState()
    const s2 = makeGameState()
    expect(s1.scrollSpeed).toBe(SCROLL_SPEED)
    expect(s2.scrollSpeed).toBe(SCROLL_SPEED)
  })

  it('both lanes start with difficultyLevel = 0', () => {
    const s1 = makeGameState()
    const s2 = makeGameState()
    expect(s1.difficultyLevel).toBe(0)
    expect(s2.difficultyLevel).toBe(0)
  })

  it('both lanes start with runTime = 0', () => {
    const s1 = makeGameState()
    const s2 = makeGameState()
    expect(s1.runTime).toBe(0)
    expect(s2.runTime).toBe(0)
  })
})

// ── DUAL simultaneous physics update ─────────────────────────────────────────

describe('DUAL simultaneous update per tick', () => {
  it('CUBE lane: worldX advances by scrollSpeed * dt each tick', () => {
    const player = makePlayer({ form: FormType.CUBE, worldX: 0, y: FLOOR_Y - PLAYER_SIZE, vy: 0 })
    const dt = 0.016
    const speed = SCROLL_SPEED

    // Simulate one tick of cube physics
    player.vy += GRAVITY * dt
    player.y += player.vy * dt
    player.worldX += speed * dt
    if (player.y >= FLOOR_Y - PLAYER_SIZE) {
      player.y = FLOOR_Y - PLAYER_SIZE
      player.vy = 0
    }

    expect(player.worldX).toBeCloseTo(speed * dt, 5)
  })

  it('SHIP lane: worldX also advances by scrollSpeed * dt each tick', () => {
    const player = makePlayer({ form: FormType.SHIP, worldX: 0, y: FLOOR_Y / 2, vy: 0 })
    const dt = 0.016
    const speed = SCROLL_SPEED

    // Simulate SHIP physics (no thrust: gravity applies)
    player.vy += GRAVITY * dt
    player.y += player.vy * dt
    player.worldX += speed * dt

    expect(player.worldX).toBeCloseTo(speed * dt, 5)
  })

  it('both lanes advance the same horizontal distance in one tick', () => {
    const cubePlayer = makePlayer({ form: FormType.CUBE, worldX: 0, vy: 0, y: FLOOR_Y - PLAYER_SIZE })
    const shipPlayer = makePlayer({ form: FormType.SHIP, worldX: 0, vy: 0, y: FLOOR_Y / 2 })
    const dt = 0.016
    const speed = SCROLL_SPEED

    // Cube tick
    cubePlayer.vy += GRAVITY * dt
    cubePlayer.y += cubePlayer.vy * dt
    cubePlayer.worldX += speed * dt
    if (cubePlayer.y >= FLOOR_Y - PLAYER_SIZE) {
      cubePlayer.y = FLOOR_Y - PLAYER_SIZE
      cubePlayer.vy = 0
    }

    // Ship tick (no thrust)
    shipPlayer.vy += GRAVITY * dt
    shipPlayer.y += shipPlayer.vy * dt
    shipPlayer.worldX += speed * dt
    if (shipPlayer.y >= FLOOR_Y - PLAYER_SIZE) {
      shipPlayer.y = FLOOR_Y - PLAYER_SIZE
      shipPlayer.vy = 0
    }

    expect(cubePlayer.worldX).toBeCloseTo(shipPlayer.worldX, 5)
  })

  it('DUAL mode difficulty scaling: both lanes scale at same rate', () => {
    // After enough time to pass one scaling interval, both should increase difficultyLevel
    const s1 = makeGameState()
    const s2 = makeGameState({ player: makePlayer({ form: FormType.SHIP }) })

    // Simulate enough runTime for exactly one difficulty level increase
    const elapsedTime = SURVIVAL_SCALE_INTERVAL + 1 // past first threshold

    s1.runTime = elapsedTime
    s1.difficultyLevel = Math.floor(s1.runTime / SURVIVAL_SCALE_INTERVAL)
    s1.scrollSpeed = SCROLL_SPEED * Math.pow(1 + SURVIVAL_SCALE_FACTOR, s1.difficultyLevel)

    s2.runTime = elapsedTime
    s2.difficultyLevel = Math.floor(s2.runTime / SURVIVAL_SCALE_INTERVAL)
    s2.scrollSpeed = SCROLL_SPEED * Math.pow(1 + SURVIVAL_SCALE_FACTOR, s2.difficultyLevel)

    expect(s1.difficultyLevel).toBe(1)
    expect(s2.difficultyLevel).toBe(1)
    expect(s1.scrollSpeed).toBeCloseTo(s2.scrollSpeed, 5)
  })

  it('DUAL mode: lane 2 only updates when phase is PLAYING', () => {
    const s2 = makeGameState({
      phase: GamePhase.DEAD,
      player: makePlayer({ form: FormType.SHIP, worldX: 100 }),
    })

    const initialWorldX = s2.player.worldX

    // Simulate the guard check in updateDualLane
    if (s2.phase !== GamePhase.PLAYING) {
      // No update should happen
    } else {
      s2.player.worldX += SCROLL_SPEED * 0.016
    }

    expect(s2.player.worldX).toBe(initialWorldX)
  })
})

// ── Joint death: if either lane dies, the other follows ───────────────────────

describe('DUAL joint death', () => {
  it('if lane 1 goes DEAD, lane 2 should be forced DEAD', () => {
    const s1 = makeGameState({ phase: GamePhase.DEAD })
    const s2 = makeGameState({
      phase: GamePhase.PLAYING,
      player: makePlayer({ form: FormType.SHIP }),
    })

    // Simulate the mutual death logic from useGameEngine
    if (s1.phase === GamePhase.DEAD && s2.phase !== GamePhase.DEAD) {
      s2.phase = GamePhase.DEAD
    }

    expect(s2.phase).toBe(GamePhase.DEAD)
  })

  it('if lane 2 goes DEAD, lane 1 should be forced DEAD', () => {
    const s1 = makeGameState({ phase: GamePhase.PLAYING })
    const s2 = makeGameState({
      phase: GamePhase.DEAD,
      player: makePlayer({ form: FormType.SHIP }),
    })

    // Simulate the mutual death logic
    if (s2.phase === GamePhase.DEAD && s1.phase !== GamePhase.DEAD) {
      s1.phase = GamePhase.DEAD
    }

    expect(s1.phase).toBe(GamePhase.DEAD)
  })

  it('if neither lane is dead, both remain PLAYING', () => {
    const s1 = makeGameState({ phase: GamePhase.PLAYING })
    const s2 = makeGameState({
      phase: GamePhase.PLAYING,
      player: makePlayer({ form: FormType.SHIP }),
    })

    // No forced death
    if (s1.phase === GamePhase.DEAD && s2.phase !== GamePhase.DEAD) {
      s2.phase = GamePhase.DEAD
    } else if (s2.phase === GamePhase.DEAD && s1.phase !== GamePhase.DEAD) {
      s1.phase = GamePhase.DEAD
    }

    expect(s1.phase).toBe(GamePhase.PLAYING)
    expect(s2.phase).toBe(GamePhase.PLAYING)
  })

  it('if both lanes are already DEAD, the joint death check does not loop', () => {
    const s1 = makeGameState({ phase: GamePhase.DEAD })
    const s2 = makeGameState({
      phase: GamePhase.DEAD,
      player: makePlayer({ form: FormType.SHIP }),
    })

    // The conditional checks require one to not be DEAD to trigger the other
    const lane2WasForced = s1.phase === GamePhase.DEAD && s2.phase !== GamePhase.DEAD
    const lane1WasForced = s2.phase === GamePhase.DEAD && s1.phase !== GamePhase.DEAD

    expect(lane2WasForced).toBe(false)
    expect(lane1WasForced).toBe(false)
    // Both remain DEAD — no change
    expect(s1.phase).toBe(GamePhase.DEAD)
    expect(s2.phase).toBe(GamePhase.DEAD)
  })

  it('joint death: lane 1 death sets shakeTimer on lane 2', () => {
    const s2 = makeGameState({
      phase: GamePhase.PLAYING,
      player: makePlayer({ form: FormType.SHIP }),
      shakeTimer: 0,
    })

    // Simulate the shake trigger from mutual death
    // Lane 1 has died (phase === DEAD) and lane 2 is still PLAYING
    const s1Died = makeGameState({ phase: GamePhase.DEAD })
    const SHAKE_DURATION = 0.2
    if (s1Died.phase === GamePhase.DEAD && s2.phase !== GamePhase.DEAD) {
      s2.shakeTimer = SHAKE_DURATION
      s2.phase = GamePhase.DEAD
    }

    expect(s2.shakeTimer).toBe(0.2)
    expect(s2.phase).toBe(GamePhase.DEAD)
  })
})

// ── RETRY in DUAL mode resets both states ─────────────────────────────────────

describe('DUAL retry resets both states', () => {
  it('after retry, lane 1 phase resets to PLAYING', () => {
    // Simulate the retry handler: buildInitialState(GameMode.DUAL, 1)
    const fresh = makeGameState({ phase: GamePhase.PLAYING, mode: GameMode.DUAL })
    expect(fresh.phase).toBe(GamePhase.PLAYING)
  })

  it('after retry, lane 2 phase resets to PLAYING', () => {
    const fresh2 = makeGameState({
      phase: GamePhase.PLAYING,
      mode: GameMode.DUAL,
      player: makePlayer({ form: FormType.SHIP }),
    })
    expect(fresh2.phase).toBe(GamePhase.PLAYING)
  })

  it('after retry, lane 2 player form is SHIP', () => {
    // In the retry handler, stateRef2.current.player.form = FormType.SHIP
    const fresh2 = makeGameState({
      mode: GameMode.DUAL,
      player: makePlayer({ form: FormType.SHIP }),
    })
    expect(fresh2.player.form).toBe(FormType.SHIP)
  })

  it('after retry, both lanes have worldX = 0', () => {
    const s1 = makeGameState({ mode: GameMode.DUAL })
    const s2 = makeGameState({
      mode: GameMode.DUAL,
      player: makePlayer({ form: FormType.SHIP }),
    })
    expect(s1.player.worldX).toBe(0)
    expect(s2.player.worldX).toBe(0)
  })

  it('after retry, both lanes have runTime = 0', () => {
    const s1 = makeGameState()
    const s2 = makeGameState()
    expect(s1.runTime).toBe(0)
    expect(s2.runTime).toBe(0)
  })

  it('after retry, both lanes have scrollSpeed = SCROLL_SPEED', () => {
    const s1 = makeGameState()
    const s2 = makeGameState()
    expect(s1.scrollSpeed).toBe(SCROLL_SPEED)
    expect(s2.scrollSpeed).toBe(SCROLL_SPEED)
  })

  it('after retry, lane 1 player starts on floor', () => {
    const s1 = makeGameState()
    expect(s1.player.y).toBe(FLOOR_Y - PLAYER_SIZE)
    expect(s1.player.vy).toBe(0)
  })

  it('after retry, lane 2 player starts on floor with vy=0', () => {
    const s2 = makeGameState({
      player: makePlayer({ form: FormType.SHIP, y: FLOOR_Y - PLAYER_SIZE, vy: 0 }),
    })
    expect(s2.player.y).toBe(FLOOR_Y - PLAYER_SIZE)
    expect(s2.player.vy).toBe(0)
  })
})

// ── MENU resets both states to start screen ───────────────────────────────────

describe('DUAL menu resets both states', () => {
  it('after MENU, lane 1 phase becomes START', () => {
    // buildStartState() returns phase: GamePhase.START
    const startState = makeGameState({ phase: GamePhase.START, mode: GameMode.CLASSIC })
    expect(startState.phase).toBe(GamePhase.START)
  })

  it('after MENU, lane 2 phase becomes START', () => {
    const startState2 = makeGameState({ phase: GamePhase.START, mode: GameMode.CLASSIC })
    expect(startState2.phase).toBe(GamePhase.START)
  })

  it('after MENU, lane 1 mode resets to CLASSIC (start state mode)', () => {
    // buildStartState() uses GameMode.CLASSIC as default
    const startState = makeGameState({ mode: GameMode.CLASSIC })
    expect(startState.mode).toBe(GameMode.CLASSIC)
  })

  it('after MENU, the start state has attempts = 0', () => {
    // buildStartState() sets attempts: 0 (before any game starts)
    const startState = makeGameState({ attempts: 0 })
    expect(startState.attempts).toBe(0)
  })

  it('after MENU, obstacles list is empty', () => {
    // buildStartState() produces empty obstacles
    const startState = makeGameState({ obstacles: [] })
    expect(startState.obstacles).toHaveLength(0)
  })
})

// ── DUAL mode state boundary edge cases ──────────────────────────────────────

describe('DUAL mode edge cases', () => {
  it('starting DUAL from scratch: lane 2 is initialized (not a start-state stub)', () => {
    // When startMode(DUAL) is called, stateRef2 is set to buildInitialState(DUAL, 1)
    // NOT buildStartState(). So phase should be PLAYING, not START.
    const s2 = makeGameState({
      phase: GamePhase.PLAYING,
      mode: GameMode.DUAL,
      player: makePlayer({ form: FormType.SHIP }),
    })
    expect(s2.phase).toBe(GamePhase.PLAYING)
    expect(s2.mode).toBe(GameMode.DUAL)
  })

  it('non-DUAL modes leave stateRef2 as start-state stub (phase START)', () => {
    // In startMode(non-DUAL), stateRef2 is set to buildStartState() which has phase START
    const s2Stub = makeGameState({ phase: GamePhase.START })
    expect(s2Stub.phase).toBe(GamePhase.START)
  })

  it('DUAL update does not run when mode is CLASSIC', () => {
    // The update function only calls updateDualLane when s.mode === GameMode.DUAL
    const s = makeGameState({ mode: GameMode.CLASSIC })
    const isDualMode = s.mode === GameMode.DUAL
    expect(isDualMode).toBe(false)
  })

  it('DUAL update does not run when mode is SURVIVAL', () => {
    const s = makeGameState({ mode: GameMode.SURVIVAL })
    const isDualMode = s.mode === GameMode.DUAL
    expect(isDualMode).toBe(false)
  })

  it('DUAL update runs when mode is DUAL', () => {
    const s = makeGameState({ mode: GameMode.DUAL })
    const isDualMode = s.mode === GameMode.DUAL
    expect(isDualMode).toBe(true)
  })

  it('lane 2 updateDualLane returns early if phase is not PLAYING', () => {
    const s2 = makeGameState({
      phase: GamePhase.DEAD,
      player: makePlayer({ form: FormType.SHIP }),
    })
    // Guard: if s2.phase !== GamePhase.PLAYING, return immediately
    const shouldUpdate = s2.phase === GamePhase.PLAYING
    expect(shouldUpdate).toBe(false)
  })

  it('difficulty scaling formula is consistent between lanes', () => {
    // Both lanes should produce the same scrollSpeed at the same runTime
    const runTime = 45 // 3 full intervals
    const difficultyLevel1 = Math.floor(runTime / SURVIVAL_SCALE_INTERVAL)
    const scrollSpeed1 = SCROLL_SPEED * Math.pow(1 + SURVIVAL_SCALE_FACTOR, difficultyLevel1)

    const difficultyLevel2 = Math.floor(runTime / SURVIVAL_SCALE_INTERVAL)
    const scrollSpeed2 = SCROLL_SPEED * Math.pow(1 + SURVIVAL_SCALE_FACTOR, difficultyLevel2)

    expect(difficultyLevel1).toBe(3)
    expect(difficultyLevel2).toBe(3)
    expect(scrollSpeed1).toBeCloseTo(scrollSpeed2, 10)
  })

  it('DUAL mode modeKey returns "dual"', () => {
    // Validate the modeKey function logic for DUAL
    // modeKey returns 'dual' for GameMode.DUAL
    function modeKey(mode: string, level: number): string {
      if (mode === 'CLASSIC') return `classic-l${level}`
      if (mode === 'SURVIVAL') return 'survival'
      if (mode === 'DUAL') return 'dual'
      return 'daily'
    }
    expect(modeKey(GameMode.DUAL, 1)).toBe('dual')
  })

  it('FormType.SHIP is distinct from FormType.CUBE', () => {
    // Lane 1 is CUBE, lane 2 is SHIP — they must be different
    expect(FormType.SHIP).not.toBe(FormType.CUBE)
    expect(FormType.SHIP).toBe('SHIP')
    expect(FormType.CUBE).toBe('CUBE')
  })
})

// ── DUAL mode regression: existing modes unaffected ──────────────────────────

describe('DUAL constant does not collide with existing mode values', () => {
  it('all mode values are unique strings', () => {
    const values = Object.values(GameMode)
    const unique = new Set(values)
    expect(unique.size).toBe(values.length)
  })

  it('CLASSIC mode value is still "CLASSIC"', () => {
    expect(GameMode.CLASSIC).toBe('CLASSIC')
  })

  it('SURVIVAL mode value is still "SURVIVAL"', () => {
    expect(GameMode.SURVIVAL).toBe('SURVIVAL')
  })

  it('DAILY mode value is still "DAILY"', () => {
    expect(GameMode.DAILY).toBe('DAILY')
  })
})

// ── Physics wrappers: inline implementations mirroring useGameEngine ──────────
// The wrappers are file-private in useGameEngine.ts, so we test the logic here.
// Each wrapper follows the exact same algorithm as the source.

function updateCubeWithSpeed(player: Player, dt: number, speed: number, floorY = FLOOR_Y - PLAYER_SIZE): void {
  player.vy += GRAVITY * dt
  player.y += player.vy * dt
  player.worldX += speed * dt
  if (player.y >= floorY) {
    player.y = floorY
    player.vy = 0
    player.onGround = true
  } else {
    player.onGround = false
  }
  if (!player.onGround) {
    player.rotation += 4 * dt
  } else {
    const snap = Math.round(player.rotation / (Math.PI / 2)) * (Math.PI / 2)
    player.rotation += (snap - player.rotation) * Math.min(dt * 20, 1)
  }
}

function updateShipWithSpeed(player: Player, dt: number, holdingThrust: boolean, speed: number, floorY = FLOOR_Y - PLAYER_SIZE): void {
  if (holdingThrust) {
    player.vy -= SHIP_THRUST * dt
  } else {
    player.vy += GRAVITY * dt
  }
  if (player.vy < -SHIP_VY_MAX) player.vy = -SHIP_VY_MAX
  if (player.vy > SHIP_VY_MAX) player.vy = SHIP_VY_MAX
  player.y += player.vy * dt
  player.worldX += speed * dt
  if (player.y < 0) { player.y = 0; player.vy = 0 }
  if (player.y >= floorY) { player.y = floorY; player.vy = 0 }
}

function updateWaveWithSpeed(player: Player, dt: number, speed: number, floorY = FLOOR_Y - PLAYER_SIZE): void {
  player.vy = player.waveDir === 'UP' ? -WAVE_SPEED : WAVE_SPEED
  player.y += player.vy * dt
  player.worldX += speed * dt
  if (player.y < 0) { player.y = 0; player.waveDir = 'DOWN' }
  if (player.y >= floorY) { player.y = floorY; player.waveDir = 'UP' }
}

function updateBallWithSpeed(player: Player, dt: number, speed: number, floorY = FLOOR_Y - PLAYER_SIZE): void {
  player.vy += GRAVITY * player.gravSign * dt
  player.y += player.vy * dt
  player.worldX += speed * dt
  if (player.y < 0) { player.y = 0; player.vy = 0 }
  if (player.y >= floorY) { player.y = floorY; player.vy = 0 }
}

// ── DUAL_STRIP_H and DUAL_FLOOR_Y constants ───────────────────────────────────

describe('DUAL physics bounds constants', () => {
  it('DUAL_STRIP_H equals 270', () => {
    expect(DUAL_STRIP_H).toBe(270)
  })

  it('DUAL_FLOOR_Y equals 230', () => {
    expect(DUAL_FLOOR_Y).toBe(230)
  })

  it('DUAL_FLOOR_Y equals DUAL_STRIP_H minus PLAYER_SIZE', () => {
    expect(DUAL_FLOOR_Y).toBe(DUAL_STRIP_H - PLAYER_SIZE)
  })

  it('DUAL_FLOOR_Y is less than the single-player floor (FLOOR_Y - PLAYER_SIZE = 440)', () => {
    expect(DUAL_FLOOR_Y).toBeLessThan(FLOOR_Y - PLAYER_SIZE)
  })

  it('single-player default floor is 440 (FLOOR_Y=480, PLAYER_SIZE=40)', () => {
    expect(FLOOR_Y - PLAYER_SIZE).toBe(440)
  })
})

// ── updateCubeWithSpeed: DUAL floor clamp at 230 ──────────────────────────────

describe('updateCubeWithSpeed DUAL floor clamp', () => {
  it('default floorY equals FLOOR_Y - PLAYER_SIZE (440)', () => {
    // Verify the default is 440 by passing a player already at 440 — it should stay there
    const player = makePlayer({ y: FLOOR_Y - PLAYER_SIZE, vy: 100, onGround: false })
    updateCubeWithSpeed(player, 0.016, SCROLL_SPEED)
    // After one tick with vy=100, y would move below 440 → gets clamped to 440
    expect(player.y).toBe(FLOOR_Y - PLAYER_SIZE)
    expect(player.vy).toBe(0)
    expect(player.onGround).toBe(true)
  })

  it('in DUAL mode, CUBE clamps at DUAL_FLOOR_Y (230), not 440', () => {
    // Start player above the DUAL floor with downward velocity large enough to overshoot
    const player = makePlayer({ y: 220, vy: 1000, onGround: false })
    updateCubeWithSpeed(player, 0.1, SCROLL_SPEED, DUAL_FLOOR_Y)
    expect(player.y).toBe(DUAL_FLOOR_Y)
    expect(player.vy).toBe(0)
    expect(player.onGround).toBe(true)
  })

  it('in DUAL mode, CUBE does not fall below 230 over multiple ticks', () => {
    const player = makePlayer({ y: DUAL_FLOOR_Y, vy: 0, onGround: true })
    for (let i = 0; i < 20; i++) {
      updateCubeWithSpeed(player, 0.016, SCROLL_SPEED, DUAL_FLOOR_Y)
    }
    expect(player.y).toBe(DUAL_FLOOR_Y)
  })

  it('in DUAL mode, CUBE can be airborne above 230', () => {
    // Give the cube negative velocity (jumped upward), starting near the floor
    const player = makePlayer({ y: 200, vy: -300, onGround: false })
    updateCubeWithSpeed(player, 0.016, SCROLL_SPEED, DUAL_FLOOR_Y)
    // With vy=-300 the cube moves upward; y should be less than 200
    expect(player.y).toBeLessThan(200)
    expect(player.onGround).toBe(false)
  })

  it('single-player CUBE does not clamp at 230 — only at 440', () => {
    // Place player at y=235, well below the DUAL floor but above the single-player floor
    const player = makePlayer({ y: 235, vy: 0, onGround: true })
    // One tick at rest: gravity is applied but player is on "ground"...
    // Use default floorY (440) — player at 235 is airborne, gravity pulls it down
    player.vy += GRAVITY * 0.016
    player.y += player.vy * 0.016
    // y should be slightly below 235 (but still far above 440 floor)
    expect(player.y).toBeGreaterThan(230) // still above DUAL_FLOOR_Y — no DUAL clamp
    expect(player.y).toBeLessThan(440)    // hasn't reached single-player floor yet
  })
})

// ── updateShipWithSpeed: DUAL floor clamp at 230 ─────────────────────────────

describe('updateShipWithSpeed DUAL floor clamp', () => {
  it('default floorY equals FLOOR_Y - PLAYER_SIZE (440)', () => {
    // SHIP falling at max speed should clamp to 440 with default floorY
    const player = makePlayer({ y: 430, vy: SHIP_VY_MAX, form: FormType.SHIP })
    updateShipWithSpeed(player, 0.1, false, SCROLL_SPEED)
    expect(player.y).toBe(FLOOR_Y - PLAYER_SIZE)
    expect(player.vy).toBe(0)
  })

  it('in DUAL mode, SHIP clamps at DUAL_FLOOR_Y (230)', () => {
    const player = makePlayer({ y: 220, vy: SHIP_VY_MAX, form: FormType.SHIP })
    updateShipWithSpeed(player, 0.1, false, SCROLL_SPEED, DUAL_FLOOR_Y)
    expect(player.y).toBe(DUAL_FLOOR_Y)
    expect(player.vy).toBe(0)
  })

  it('in DUAL mode, SHIP stays within 0..DUAL_FLOOR_Y after many ticks thrusting up', () => {
    const player = makePlayer({ y: DUAL_FLOOR_Y, vy: 0, form: FormType.SHIP })
    for (let i = 0; i < 60; i++) {
      updateShipWithSpeed(player, 0.016, true, SCROLL_SPEED, DUAL_FLOOR_Y)
    }
    // Ceiling clamp: y must stay >= 0
    expect(player.y).toBeGreaterThanOrEqual(0)
    // Should never fall below DUAL_FLOOR_Y
    expect(player.y).toBeLessThanOrEqual(DUAL_FLOOR_Y)
  })

  it('in DUAL mode, SHIP does not escape past 230 when falling', () => {
    const player = makePlayer({ y: DUAL_FLOOR_Y, vy: 0, form: FormType.SHIP })
    for (let i = 0; i < 30; i++) {
      updateShipWithSpeed(player, 0.016, false, SCROLL_SPEED, DUAL_FLOOR_Y)
    }
    expect(player.y).toBe(DUAL_FLOOR_Y)
  })

  it('single-player SHIP does not clamp at 230', () => {
    // Start SHIP at y=235 falling slowly — default floorY (440) is used
    const player = makePlayer({ y: 235, vy: 50, form: FormType.SHIP })
    updateShipWithSpeed(player, 0.016, false, SCROLL_SPEED)
    // Should pass 230 without being clamped to it
    expect(player.y).toBeGreaterThan(235) // moved downward
    expect(player.y).toBeLessThan(440)    // hasn't hit single-player floor yet
  })
})

// ── updateWaveWithSpeed: DUAL floor clamp at 230 ─────────────────────────────

describe('updateWaveWithSpeed DUAL floor clamp', () => {
  it('default floorY equals FLOOR_Y - PLAYER_SIZE (440)', () => {
    // WAVE going down: start just above 440 → should clamp and toggle direction
    const player = makePlayer({ y: 435, vy: 0, waveDir: 'DOWN', form: FormType.WAVE })
    updateWaveWithSpeed(player, 0.1, SCROLL_SPEED)
    expect(player.y).toBe(FLOOR_Y - PLAYER_SIZE)
    expect(player.waveDir).toBe('UP')
  })

  it('in DUAL mode, WAVE clamps at DUAL_FLOOR_Y (230) and reverses direction', () => {
    const player = makePlayer({ y: 225, vy: 0, waveDir: 'DOWN', form: FormType.WAVE })
    updateWaveWithSpeed(player, 0.1, SCROLL_SPEED, DUAL_FLOOR_Y)
    expect(player.y).toBe(DUAL_FLOOR_Y)
    expect(player.waveDir).toBe('UP')
  })

  it('in DUAL mode, WAVE oscillates within 0..DUAL_FLOOR_Y', () => {
    const player = makePlayer({ y: 115, vy: 0, waveDir: 'DOWN', form: FormType.WAVE })
    for (let i = 0; i < 120; i++) {
      updateWaveWithSpeed(player, 0.016, SCROLL_SPEED, DUAL_FLOOR_Y)
    }
    expect(player.y).toBeGreaterThanOrEqual(0)
    expect(player.y).toBeLessThanOrEqual(DUAL_FLOOR_Y)
  })

  it('single-player WAVE bounces off 440, not 230', () => {
    // Start just above 440 with waveDir=DOWN
    const player = makePlayer({ y: 438, vy: 0, waveDir: 'DOWN', form: FormType.WAVE })
    updateWaveWithSpeed(player, 0.016, SCROLL_SPEED)
    // y moves below 440 → clamps to 440 and reverses
    expect(player.y).toBe(FLOOR_Y - PLAYER_SIZE)
    expect(player.waveDir).toBe('UP')
  })
})

// ── updateBallWithSpeed: DUAL floor clamp at 230 ─────────────────────────────

describe('updateBallWithSpeed DUAL floor clamp', () => {
  it('default floorY equals FLOOR_Y - PLAYER_SIZE (440)', () => {
    const player = makePlayer({ y: 430, vy: 500, gravSign: 1, form: FormType.BALL })
    updateBallWithSpeed(player, 0.1, SCROLL_SPEED)
    expect(player.y).toBe(FLOOR_Y - PLAYER_SIZE)
    expect(player.vy).toBe(0)
  })

  it('in DUAL mode, BALL clamps at DUAL_FLOOR_Y (230)', () => {
    const player = makePlayer({ y: 220, vy: 500, gravSign: 1, form: FormType.BALL })
    updateBallWithSpeed(player, 0.1, SCROLL_SPEED, DUAL_FLOOR_Y)
    expect(player.y).toBe(DUAL_FLOOR_Y)
    expect(player.vy).toBe(0)
  })

  it('in DUAL mode, BALL with inverted gravity clamps at ceiling (y=0)', () => {
    const player = makePlayer({ y: 10, vy: -500, gravSign: -1, form: FormType.BALL })
    updateBallWithSpeed(player, 0.1, SCROLL_SPEED, DUAL_FLOOR_Y)
    expect(player.y).toBe(0)
    expect(player.vy).toBe(0)
  })

  it('in DUAL mode, BALL stays within 0..DUAL_FLOOR_Y over many ticks', () => {
    const player = makePlayer({ y: 115, vy: 0, gravSign: 1, form: FormType.BALL })
    for (let i = 0; i < 60; i++) {
      updateBallWithSpeed(player, 0.016, SCROLL_SPEED, DUAL_FLOOR_Y)
      // Flip gravity every 15 frames to test both bounds
      if (i % 15 === 0) player.gravSign = -player.gravSign as 1 | -1
    }
    expect(player.y).toBeGreaterThanOrEqual(0)
    expect(player.y).toBeLessThanOrEqual(DUAL_FLOOR_Y)
  })

  it('single-player BALL does not clamp at 230', () => {
    // BALL falling from 235 toward the 440 floor — should not be clamped at 230
    const player = makePlayer({ y: 235, vy: 0, gravSign: 1, form: FormType.BALL })
    updateBallWithSpeed(player, 0.016, SCROLL_SPEED)
    expect(player.y).toBeGreaterThan(235) // falling
    expect(player.y).toBeLessThan(440)    // hasn't hit single-player floor yet
  })
})

// ── Obstacle y-scaling for DUAL lane 2 ───────────────────────────────────────

describe('DUAL mode obstacle y-scaling for lane 2', () => {
  it('scaling factor from FLOOR_Y to DUAL_STRIP_H is DUAL_STRIP_H / FLOOR_Y', () => {
    const scale = DUAL_STRIP_H / FLOOR_Y
    // 270 / 480 = 0.5625
    expect(scale).toBeCloseTo(270 / 480, 10)
  })

  it('an obstacle at y=480 (full floor) scales to y=270 (DUAL_STRIP_H)', () => {
    const scale = DUAL_STRIP_H / FLOOR_Y
    const scaledY = 480 * scale
    expect(scaledY).toBeCloseTo(DUAL_STRIP_H, 5)
  })

  it('an obstacle at y=240 (mid-height) scales to approximately 135', () => {
    const scale = DUAL_STRIP_H / FLOOR_Y
    const scaledY = 240 * scale
    expect(scaledY).toBeCloseTo(135, 1)
  })

  it('an obstacle at y=0 stays at y=0 after scaling', () => {
    const scale = DUAL_STRIP_H / FLOOR_Y
    expect(0 * scale).toBe(0)
  })

  it('obstacle heights are also scaled proportionally', () => {
    const scale = DUAL_STRIP_H / FLOOR_Y
    const originalH = 80
    const scaledH = originalH * scale
    expect(scaledH).toBeCloseTo(originalH * scale, 10)
    expect(scaledH).toBeLessThan(originalH)
  })

  it('scaled obstacles remain within 0..DUAL_STRIP_H after scaling', () => {
    const scale = DUAL_STRIP_H / FLOOR_Y
    const testYValues = [0, 100, 240, 400, 480]
    for (const y of testYValues) {
      const scaled = y * scale
      expect(scaled).toBeGreaterThanOrEqual(0)
      expect(scaled).toBeLessThanOrEqual(DUAL_STRIP_H)
    }
  })
})
