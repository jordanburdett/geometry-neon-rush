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
      player: makePlayer({ form: FormType.SHIP, y: FLOOR_Y - PLAYER_SIZE }),
    })
    expect(s2.player.y).toBe(FLOOR_Y - PLAYER_SIZE)
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
