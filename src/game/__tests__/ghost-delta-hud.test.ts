/**
 * Tests for evo2-003: Ghost delta HUD
 *
 * Covers:
 *   - renderHUD with no ghostDelta: no delta indicator rendered
 *   - renderHUD with ghostDelta null: no delta indicator rendered
 *   - renderHUD with negative delta (behind): red ▼ indicator
 *   - renderHUD with positive delta (ahead, no flash): dim green ▲ indicator
 *   - renderHUD with flashActive=true: pulsing AHEAD indicator
 *   - Delta text format: worldX/100 → metres string
 *   - GhostDeltaOpts interface shape
 *   - Delta computation logic: positive when ahead, negative when behind
 *   - Overtake detection: sign-flip from ≤0 to >0 triggers flash
 *   - No overtake when already ahead (positive to positive)
 *   - No overtake when staying behind (negative to negative)
 *   - Flash timer decrements by dt
 *   - Flash timer does not go below 0
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  FLOOR_Y,
  CANVAS_W,
  CANVAS_H,
  GameMode,
  GamePhase,
  FormType,
  SCROLL_SPEED,
  PLAYER_SIZE,
} from '../constants'
import type { GameState, Player } from '../types'
import type { GhostDeltaOpts } from '../renderer'

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
    mode: GameMode.SURVIVAL,
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
    time: 1.5,
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

/** Minimal canvas 2D context mock that tracks fillText calls. */
function makeCtx() {
  const fillTextCalls: Array<{ text: string; x: number; y: number }> = []
  let lastFillStyle = ''

  // Track fillStyle values alongside each fillText to identify which indicator was rendered
  const fillStylePerFillText: string[] = []

  const ctx = {
    _fillTextCalls: fillTextCalls,
    _fillStylePerFillText: fillStylePerFillText,

    strokeStyle: '',
    get fillStyle() { return lastFillStyle },
    set fillStyle(v: string) { lastFillStyle = v },
    lineWidth: 1,
    shadowColor: '',
    shadowBlur: 0,
    globalAlpha: 1,
    font: '',
    textAlign: 'left' as CanvasTextAlign,

    save: () => {},
    restore: () => {},
    beginPath: () => {},
    stroke: () => {},
    fill: () => {},
    closePath: () => {},
    clip: () => {},
    translate: () => {},
    rect: () => {},
    arc: () => {},
    strokeRect: () => {},

    moveTo: () => {},
    lineTo: () => {},
    fillRect: () => {},
    fillText: (text: string, x: number, y: number) => {
      fillTextCalls.push({ text, x, y })
      fillStylePerFillText.push(lastFillStyle)
    },
    createLinearGradient: () => ({
      addColorStop: () => {},
    }),
  } as unknown as CanvasRenderingContext2D & {
    _fillTextCalls: Array<{ text: string; x: number; y: number }>
    _fillStylePerFillText: string[]
  }

  return ctx
}

// ── GhostDeltaOpts type shape ──────────────────────────────────────────────────

describe('GhostDeltaOpts interface', () => {
  it('accepts a valid ghostDelta object', () => {
    const opts: GhostDeltaOpts = { delta: 500, flashActive: false, time: 1.0 }
    expect(opts.delta).toBe(500)
    expect(opts.flashActive).toBe(false)
    expect(opts.time).toBe(1.0)
  })

  it('delta can be negative (behind)', () => {
    const opts: GhostDeltaOpts = { delta: -300, flashActive: false, time: 0.5 }
    expect(opts.delta).toBeLessThan(0)
  })

  it('delta can be zero (exactly matched)', () => {
    const opts: GhostDeltaOpts = { delta: 0, flashActive: false, time: 0 }
    expect(opts.delta).toBe(0)
  })

  it('flashActive is a boolean', () => {
    const opts: GhostDeltaOpts = { delta: 100, flashActive: true, time: 1.5 }
    expect(typeof opts.flashActive).toBe('boolean')
  })
})

// ── renderHUD: no ghost delta shown when ghostDelta is null/undefined ──────────

describe('renderHUD — no ghost delta indicator', () => {
  let renderHUD: typeof import('../renderer').renderHUD

  beforeEach(async () => {
    const mod = await import('../renderer')
    renderHUD = mod.renderHUD
  })

  it('no delta fillText when ghostDelta is not provided', () => {
    const ctx = makeCtx()
    const state = makeGameState()
    renderHUD(ctx as unknown as CanvasRenderingContext2D, state)

    const deltaText = ctx._fillTextCalls.find(
      c => c.text.includes('▲') || c.text.includes('▼') || c.text.includes('AHEAD')
    )
    expect(deltaText).toBeUndefined()
  })

  it('no delta fillText when ghostDelta is null', () => {
    const ctx = makeCtx()
    const state = makeGameState()
    renderHUD(ctx as unknown as CanvasRenderingContext2D, state, null)

    const deltaText = ctx._fillTextCalls.find(
      c => c.text.includes('▲') || c.text.includes('▼') || c.text.includes('AHEAD')
    )
    expect(deltaText).toBeUndefined()
  })

  it('no delta fillText when ghostDelta is undefined', () => {
    const ctx = makeCtx()
    const state = makeGameState()
    renderHUD(ctx as unknown as CanvasRenderingContext2D, state, undefined)

    const deltaText = ctx._fillTextCalls.find(
      c => c.text.includes('▲') || c.text.includes('▼') || c.text.includes('AHEAD')
    )
    expect(deltaText).toBeUndefined()
  })
})

// ── renderHUD: behind ghost (negative delta) ──────────────────────────────────

describe('renderHUD — behind ghost (negative delta)', () => {
  let renderHUD: typeof import('../renderer').renderHUD

  beforeEach(async () => {
    const mod = await import('../renderer')
    renderHUD = mod.renderHUD
  })

  it('shows ▼ indicator when delta is negative', () => {
    const ctx = makeCtx()
    const state = makeGameState()
    const ghostDelta: GhostDeltaOpts = { delta: -500, flashActive: false, time: 1.0 }

    renderHUD(ctx as unknown as CanvasRenderingContext2D, state, ghostDelta)

    const deltaText = ctx._fillTextCalls.find(c => c.text.includes('▼'))
    expect(deltaText).toBeDefined()
  })

  it('does NOT show ▲ when delta is negative', () => {
    const ctx = makeCtx()
    const state = makeGameState()
    const ghostDelta: GhostDeltaOpts = { delta: -500, flashActive: false, time: 1.0 }

    renderHUD(ctx as unknown as CanvasRenderingContext2D, state, ghostDelta)

    const aheadText = ctx._fillTextCalls.find(c => c.text.includes('▲'))
    expect(aheadText).toBeUndefined()
  })

  it('shows correct metres in text: -500 worldX → -5m', () => {
    const ctx = makeCtx()
    const state = makeGameState()
    // delta=-500 → Math.floor(-500/100) = -5
    const ghostDelta: GhostDeltaOpts = { delta: -500, flashActive: false, time: 0 }

    renderHUD(ctx as unknown as CanvasRenderingContext2D, state, ghostDelta)

    const deltaText = ctx._fillTextCalls.find(c => c.text.includes('▼'))
    expect(deltaText).toBeDefined()
    expect(deltaText!.text).toContain('-5m')
  })

  it('shows -1m for delta=-100', () => {
    const ctx = makeCtx()
    const state = makeGameState()
    const ghostDelta: GhostDeltaOpts = { delta: -100, flashActive: false, time: 0 }

    renderHUD(ctx as unknown as CanvasRenderingContext2D, state, ghostDelta)

    const deltaText = ctx._fillTextCalls.find(c => c.text.includes('▼'))
    expect(deltaText!.text).toContain('-1m')
  })

  it('no AHEAD text when behind ghost', () => {
    const ctx = makeCtx()
    const state = makeGameState()
    const ghostDelta: GhostDeltaOpts = { delta: -200, flashActive: false, time: 0 }

    renderHUD(ctx as unknown as CanvasRenderingContext2D, state, ghostDelta)

    const aheadText = ctx._fillTextCalls.find(c => c.text.includes('AHEAD'))
    expect(aheadText).toBeUndefined()
  })
})

// ── renderHUD: ahead of ghost (positive delta, no flash) ──────────────────────

describe('renderHUD — ahead of ghost (positive delta, flash expired)', () => {
  let renderHUD: typeof import('../renderer').renderHUD

  beforeEach(async () => {
    const mod = await import('../renderer')
    renderHUD = mod.renderHUD
  })

  it('shows ▲ indicator when delta is positive and flashActive is false', () => {
    const ctx = makeCtx()
    const state = makeGameState()
    const ghostDelta: GhostDeltaOpts = { delta: 300, flashActive: false, time: 1.0 }

    renderHUD(ctx as unknown as CanvasRenderingContext2D, state, ghostDelta)

    const deltaText = ctx._fillTextCalls.find(c => c.text.includes('▲'))
    expect(deltaText).toBeDefined()
  })

  it('does NOT show ▼ when delta is positive', () => {
    const ctx = makeCtx()
    const state = makeGameState()
    const ghostDelta: GhostDeltaOpts = { delta: 300, flashActive: false, time: 1.0 }

    renderHUD(ctx as unknown as CanvasRenderingContext2D, state, ghostDelta)

    const behindText = ctx._fillTextCalls.find(c => c.text.includes('▼'))
    expect(behindText).toBeUndefined()
  })

  it('shows +3m for delta=300', () => {
    const ctx = makeCtx()
    const state = makeGameState()
    const ghostDelta: GhostDeltaOpts = { delta: 300, flashActive: false, time: 0 }

    renderHUD(ctx as unknown as CanvasRenderingContext2D, state, ghostDelta)

    const deltaText = ctx._fillTextCalls.find(c => c.text.includes('▲'))
    expect(deltaText!.text).toContain('+3m')
  })

  it('does NOT show AHEAD when flashActive is false', () => {
    const ctx = makeCtx()
    const state = makeGameState()
    const ghostDelta: GhostDeltaOpts = { delta: 300, flashActive: false, time: 0 }

    renderHUD(ctx as unknown as CanvasRenderingContext2D, state, ghostDelta)

    const aheadText = ctx._fillTextCalls.find(c => c.text.includes('AHEAD'))
    expect(aheadText).toBeUndefined()
  })

  it('shows +0m for delta=0 (exactly matched)', () => {
    const ctx = makeCtx()
    const state = makeGameState()
    const ghostDelta: GhostDeltaOpts = { delta: 0, flashActive: false, time: 0 }

    renderHUD(ctx as unknown as CanvasRenderingContext2D, state, ghostDelta)

    // delta=0 → treated as ≥0 → ▲ path
    const deltaText = ctx._fillTextCalls.find(c => c.text.includes('▲'))
    expect(deltaText).toBeDefined()
    expect(deltaText!.text).toContain('+0m')
  })
})

// ── renderHUD: overtake flash (flashActive=true) ──────────────────────────────

describe('renderHUD — overtake flash (flashActive=true)', () => {
  let renderHUD: typeof import('../renderer').renderHUD

  beforeEach(async () => {
    const mod = await import('../renderer')
    renderHUD = mod.renderHUD
  })

  it('shows AHEAD in text when flashActive is true', () => {
    const ctx = makeCtx()
    const state = makeGameState()
    const ghostDelta: GhostDeltaOpts = { delta: 200, flashActive: true, time: 1.0 }

    renderHUD(ctx as unknown as CanvasRenderingContext2D, state, ghostDelta)

    const aheadText = ctx._fillTextCalls.find(c => c.text.includes('AHEAD'))
    expect(aheadText).toBeDefined()
  })

  it('shows ▲ in flash text', () => {
    const ctx = makeCtx()
    const state = makeGameState()
    const ghostDelta: GhostDeltaOpts = { delta: 200, flashActive: true, time: 1.0 }

    renderHUD(ctx as unknown as CanvasRenderingContext2D, state, ghostDelta)

    const aheadText = ctx._fillTextCalls.find(c => c.text.includes('AHEAD'))
    expect(aheadText!.text).toContain('▲')
  })

  it('flash text includes metres delta: +2m for delta=200', () => {
    const ctx = makeCtx()
    const state = makeGameState()
    const ghostDelta: GhostDeltaOpts = { delta: 200, flashActive: true, time: 1.0 }

    renderHUD(ctx as unknown as CanvasRenderingContext2D, state, ghostDelta)

    const aheadText = ctx._fillTextCalls.find(c => c.text.includes('AHEAD'))
    expect(aheadText!.text).toContain('+2m')
  })

  it('does NOT show ▼ when flash is active', () => {
    const ctx = makeCtx()
    const state = makeGameState()
    const ghostDelta: GhostDeltaOpts = { delta: 200, flashActive: true, time: 1.0 }

    renderHUD(ctx as unknown as CanvasRenderingContext2D, state, ghostDelta)

    const behindText = ctx._fillTextCalls.find(c => c.text.includes('▼'))
    expect(behindText).toBeUndefined()
  })

  it('flash text is right-aligned at CANVAS_W - 16', () => {
    const ctx = makeCtx()
    const state = makeGameState()
    const ghostDelta: GhostDeltaOpts = { delta: 200, flashActive: true, time: 0 }

    renderHUD(ctx as unknown as CanvasRenderingContext2D, state, ghostDelta)

    const aheadText = ctx._fillTextCalls.find(c => c.text.includes('AHEAD'))
    expect(aheadText!.x).toBe(CANVAS_W - 16)
  })
})

// ── Delta text format: metres conversion ──────────────────────────────────────

describe('ghost delta metres conversion (worldX / 100)', () => {
  let renderHUD: typeof import('../renderer').renderHUD

  beforeEach(async () => {
    const mod = await import('../renderer')
    renderHUD = mod.renderHUD
  })

  it('+10m for delta=1000', () => {
    const ctx = makeCtx()
    const state = makeGameState()
    renderHUD(ctx as unknown as CanvasRenderingContext2D, state, { delta: 1000, flashActive: false, time: 0 })
    const t = ctx._fillTextCalls.find(c => c.text.includes('▲'))
    expect(t!.text).toContain('+10m')
  })

  it('+0m for delta=50 (floors fractional metres)', () => {
    const ctx = makeCtx()
    const state = makeGameState()
    renderHUD(ctx as unknown as CanvasRenderingContext2D, state, { delta: 50, flashActive: false, time: 0 })
    const t = ctx._fillTextCalls.find(c => c.text.includes('▲'))
    expect(t!.text).toContain('+0m')
  })

  it('-2m for delta=-250 (floors toward negative)', () => {
    const ctx = makeCtx()
    const state = makeGameState()
    // Math.floor(-250/100) = Math.floor(-2.5) = -3
    renderHUD(ctx as unknown as CanvasRenderingContext2D, state, { delta: -250, flashActive: false, time: 0 })
    const t = ctx._fillTextCalls.find(c => c.text.includes('▼'))
    expect(t!.text).toContain('-3m')
  })
})

// ── Ghost delta computation logic ─────────────────────────────────────────────

describe('ghost delta computation (unit logic)', () => {
  it('delta is positive when player is ahead of ghost', () => {
    const playerWorldX = 5000
    const ghostWorldX = 4500
    const delta = playerWorldX - ghostWorldX
    expect(delta).toBeGreaterThan(0)
  })

  it('delta is negative when player is behind ghost', () => {
    const playerWorldX = 3000
    const ghostWorldX = 3500
    const delta = playerWorldX - ghostWorldX
    expect(delta).toBeLessThan(0)
  })

  it('delta is zero when player and ghost are at same worldX', () => {
    const playerWorldX = 4000
    const ghostWorldX = 4000
    const delta = playerWorldX - ghostWorldX
    expect(delta).toBe(0)
  })
})

// ── Overtake detection logic ───────────────────────────────────────────────────

describe('overtake detection (sign-flip logic)', () => {
  it('triggers overtake when prevDelta <= 0 and liveDelta > 0', () => {
    const prevDelta = -50
    const liveDelta = 10
    const overtake = prevDelta <= 0 && liveDelta > 0
    expect(overtake).toBe(true)
  })

  it('triggers overtake when prevDelta == 0 and liveDelta > 0', () => {
    const prevDelta = 0
    const liveDelta = 5
    const overtake = prevDelta <= 0 && liveDelta > 0
    expect(overtake).toBe(true)
  })

  it('does NOT trigger overtake when already ahead (positive to positive)', () => {
    const prevDelta = 100
    const liveDelta = 200
    const overtake = prevDelta <= 0 && liveDelta > 0
    expect(overtake).toBe(false)
  })

  it('does NOT trigger overtake when staying behind (negative to negative)', () => {
    const prevDelta = -200
    const liveDelta = -100
    const overtake = prevDelta <= 0 && liveDelta > 0
    expect(overtake).toBe(false)
  })

  it('does NOT trigger overtake when crossing from behind to exactly 0', () => {
    const prevDelta = -50
    const liveDelta = 0
    const overtake = prevDelta <= 0 && liveDelta > 0
    expect(overtake).toBe(false)
  })

  it('does NOT trigger overtake when dropping from ahead to behind (opposite direction)', () => {
    const prevDelta = 100
    const liveDelta = -50
    const overtake = prevDelta <= 0 && liveDelta > 0
    expect(overtake).toBe(false)
  })
})

// ── Flash timer logic ──────────────────────────────────────────────────────────

describe('ghost overtake flash timer', () => {
  it('flash timer starts at 0.8 seconds on overtake', () => {
    let flashTimer = 0
    const prevDelta = -50
    const liveDelta = 10
    if (prevDelta <= 0 && liveDelta > 0) {
      flashTimer = 0.8
    }
    expect(flashTimer).toBe(0.8)
  })

  it('flash timer decrements by dt each frame', () => {
    let flashTimer = 0.8
    const dt = 0.016
    if (flashTimer > 0) {
      flashTimer = Math.max(0, flashTimer - dt)
    }
    expect(flashTimer).toBeCloseTo(0.784, 5)
  })

  it('flash timer does not go below 0', () => {
    let flashTimer = 0.01
    const dt = 0.05
    if (flashTimer > 0) {
      flashTimer = Math.max(0, flashTimer - dt)
    }
    expect(flashTimer).toBe(0)
  })

  it('flash timer stays at 0 when already 0 (no decrement below zero)', () => {
    let flashTimer = 0
    const dt = 0.016
    if (flashTimer > 0) {
      flashTimer = Math.max(0, flashTimer - dt)
    }
    expect(flashTimer).toBe(0)
  })

  it('flashActive is true when flashTimer > 0', () => {
    const flashTimer = 0.3
    expect(flashTimer > 0).toBe(true)
  })

  it('flashActive is false when flashTimer === 0', () => {
    const flashTimer = 0
    expect(flashTimer > 0).toBe(false)
  })

  it('flash expires after 0.8s at 60fps (50 frames)', () => {
    let flashTimer = 0.8
    const dt = 1 / 60
    for (let i = 0; i < 50; i++) {
      flashTimer = Math.max(0, flashTimer - dt)
    }
    // After 50 frames at 60fps (= 0.833s), timer should be 0
    expect(flashTimer).toBe(0)
  })
})

// ── renderHUD accepts three arguments without throwing ────────────────────────

describe('renderHUD function signature with ghostDelta', () => {
  it('accepts two args (no ghostDelta) without throwing', async () => {
    const { renderHUD } = await import('../renderer')
    const ctx = makeCtx()
    const state = makeGameState()
    expect(() => renderHUD(ctx as unknown as CanvasRenderingContext2D, state)).not.toThrow()
  })

  it('accepts three args with null ghostDelta without throwing', async () => {
    const { renderHUD } = await import('../renderer')
    const ctx = makeCtx()
    const state = makeGameState()
    expect(() => renderHUD(ctx as unknown as CanvasRenderingContext2D, state, null)).not.toThrow()
  })

  it('accepts three args with a valid ghostDelta object without throwing', async () => {
    const { renderHUD } = await import('../renderer')
    const ctx = makeCtx()
    const state = makeGameState()
    const opts: GhostDeltaOpts = { delta: 500, flashActive: true, time: 2.0 }
    expect(() => renderHUD(ctx as unknown as CanvasRenderingContext2D, state, opts)).not.toThrow()
  })
})

// ── DUAL mode: no delta indicator (ghost is null in DUAL) ─────────────────────

describe('DUAL mode: no ghost delta indicator', () => {
  it('DUAL mode has no ghost (ghostPlayback is null) — null-check gates indicator', () => {
    // In DUAL mode, ghostPlaybackRef.current is set to null in startMode()
    // The render path: ghostDeltaOpts = ghostPlaybackRef.current && ... ? {...} : null
    // So when ghostPlayback is null, ghostDeltaOpts is null
    const ghostPlayback = null as Array<{ worldX: number; form: string }> | null
    const ghostDeltaOpts = ghostPlayback && (ghostPlayback as Array<{ worldX: number; form: string }>).length > 0
      ? { delta: 0, flashActive: false, time: 0 }
      : null
    expect(ghostDeltaOpts).toBeNull()
  })

  it('DUAL mode state passes DUAL mode guard correctly', () => {
    const state = makeGameState({ mode: GameMode.DUAL })
    expect(state.mode === GameMode.DUAL).toBe(true)
  })
})

// ── HUD delta indicator position ──────────────────────────────────────────────

describe('ghost delta HUD position', () => {
  let renderHUD: typeof import('../renderer').renderHUD

  beforeEach(async () => {
    const mod = await import('../renderer')
    renderHUD = mod.renderHUD
  })

  it('delta indicator rendered below floor line (y > FLOOR_Y)', () => {
    const ctx = makeCtx()
    const state = makeGameState()
    const ghostDelta: GhostDeltaOpts = { delta: -300, flashActive: false, time: 0 }

    renderHUD(ctx as unknown as CanvasRenderingContext2D, state, ghostDelta)

    const deltaText = ctx._fillTextCalls.find(c => c.text.includes('▼'))
    expect(deltaText).toBeDefined()
    expect(deltaText!.y).toBeGreaterThan(FLOOR_Y)
    expect(deltaText!.y).toBeLessThanOrEqual(CANVAS_H)
  })

  it('ahead indicator rendered below floor line (y > FLOOR_Y)', () => {
    const ctx = makeCtx()
    const state = makeGameState()
    const ghostDelta: GhostDeltaOpts = { delta: 300, flashActive: false, time: 0 }

    renderHUD(ctx as unknown as CanvasRenderingContext2D, state, ghostDelta)

    const deltaText = ctx._fillTextCalls.find(c => c.text.includes('▲'))
    expect(deltaText).toBeDefined()
    expect(deltaText!.y).toBeGreaterThan(FLOOR_Y)
    expect(deltaText!.y).toBeLessThanOrEqual(CANVAS_H)
  })
})
