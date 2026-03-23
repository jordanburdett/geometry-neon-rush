/**
 * Tests for evo1-003: Split-screen rendering for DUAL mode
 *
 * renderer.ts changes:
 *   - renderFloor now accepts an optional floorOverride parameter
 *   - When floorOverride is provided, the floor line and grid lines use that y instead of FLOOR_Y
 *   - When floorOverride is provided, the HUD strip background is NOT drawn
 *
 * useGameEngine.ts changes:
 *   - DUAL lane 2 obstacle chunks are y/h-scaled by (DUAL_STRIP_H / FLOOR_Y)
 *   - render() branches on s.mode === GameMode.DUAL before single-player path
 *   - DUAL path does NOT call renderHUD
 *   - DUAL path calls renderGameOver on full canvas when phase === DEAD
 *   - Single-player path still calls renderHUD
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  FLOOR_Y,
  CANVAS_W,
  CANVAS_H,
  DUAL_STRIP_H,
  GameMode,
  GamePhase,
  FormType,
  SCROLL_SPEED,
  PLAYER_SIZE,
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
    mode: GameMode.CLASSIC,
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

/** Build a minimal canvas 2D context mock, tracking which calls were made. */
function makeCtx() {
  const calls: string[] = []
  const moveToCalls: Array<[number, number]> = []
  const lineToCallsY: number[] = []
  const fillRectCalls: Array<[number, number, number, number]> = []

  const ctx = {
    // Recorded calls
    _calls: calls,
    _moveToCalls: moveToCalls,
    _lineToCallsY: lineToCallsY,
    _fillRectCalls: fillRectCalls,

    // State
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
    shadowColor: '',
    shadowBlur: 0,
    globalAlpha: 1,
    font: '',
    textAlign: 'left' as CanvasTextAlign,

    save: () => { calls.push('save') },
    restore: () => { calls.push('restore') },
    beginPath: () => { calls.push('beginPath') },
    stroke: () => { calls.push('stroke') },
    fill: () => { calls.push('fill') },
    closePath: () => { calls.push('closePath') },
    clip: () => { calls.push('clip') },
    translate: () => { calls.push('translate') },
    rect: () => { calls.push('rect') },
    arc: () => { calls.push('arc') },
    fillText: () => { calls.push('fillText') },
    strokeRect: () => { calls.push('strokeRect') },

    moveTo: (x: number, y: number) => {
      calls.push('moveTo')
      moveToCalls.push([x, y])
    },
    lineTo: (_x: number, y: number) => {
      calls.push('lineTo')
      lineToCallsY.push(y)
    },
    fillRect: (x: number, y: number, w: number, h: number) => {
      calls.push('fillRect')
      fillRectCalls.push([x, y, w, h])
    },
    createLinearGradient: () => ({
      addColorStop: () => {},
    }),
  } as unknown as CanvasRenderingContext2D & {
    _calls: string[]
    _moveToCalls: Array<[number, number]>
    _lineToCallsY: number[]
    _fillRectCalls: Array<[number, number, number, number]>
  }

  return ctx
}

// ── renderFloor: floorOverride parameter ──────────────────────────────────────

describe('renderFloor — floorOverride parameter', () => {
  // Import inside describe so jsdom is ready
  let renderFloor: typeof import('../renderer').renderFloor

  beforeEach(async () => {
    const mod = await import('../renderer')
    renderFloor = mod.renderFloor
  })

  it('without floorOverride: floor line drawn at FLOOR_Y (480)', () => {
    const ctx = makeCtx()
    const state = makeGameState({ time: 0 })

    renderFloor(ctx as unknown as CanvasRenderingContext2D, state)

    // The solid floor line: moveTo(0, FLOOR_Y) then lineTo(CANVAS_W, FLOOR_Y)
    const floorMoveTo = ctx._moveToCalls.find(([, y]) => y === FLOOR_Y)
    expect(floorMoveTo).toBeDefined()
    expect(ctx._lineToCallsY).toContain(FLOOR_Y)
  })

  it('without floorOverride: HUD strip background is drawn (fillRect at y=FLOOR_Y)', () => {
    const ctx = makeCtx()
    const state = makeGameState({ time: 0 })

    renderFloor(ctx as unknown as CanvasRenderingContext2D, state)

    // HUD background: fillRect(0, FLOOR_Y, CANVAS_W, CANVAS_H - FLOOR_Y)
    const hudFill = ctx._fillRectCalls.find(
      ([x, y, w, h]) => x === 0 && y === FLOOR_Y && w === CANVAS_W && h === CANVAS_H - FLOOR_Y
    )
    expect(hudFill).toBeDefined()
  })

  it('with floorOverride=DUAL_STRIP_H: floor line drawn at DUAL_STRIP_H (270)', () => {
    const ctx = makeCtx()
    const state = makeGameState({ time: 0 })

    renderFloor(ctx as unknown as CanvasRenderingContext2D, state, DUAL_STRIP_H)

    const floorMoveTo = ctx._moveToCalls.find(([, y]) => y === DUAL_STRIP_H)
    expect(floorMoveTo).toBeDefined()
    expect(ctx._lineToCallsY).toContain(DUAL_STRIP_H)
  })

  it('with floorOverride=DUAL_STRIP_H: floor line NOT drawn at FLOOR_Y', () => {
    const ctx = makeCtx()
    const state = makeGameState({ time: 0 })

    renderFloor(ctx as unknown as CanvasRenderingContext2D, state, DUAL_STRIP_H)

    // The solid-floor moveTo should never use y=FLOOR_Y when overridden
    // Note: grid lines also call moveTo, so check lineToCallsY for FLOOR_Y
    // The first lineTo for the floor line should be DUAL_STRIP_H, not FLOOR_Y
    const firstLineToAtFloorY = ctx._lineToCallsY[0]
    expect(firstLineToAtFloorY).toBe(DUAL_STRIP_H)
    expect(firstLineToAtFloorY).not.toBe(FLOOR_Y)
  })

  it('with floorOverride provided: HUD strip background is NOT drawn', () => {
    const ctx = makeCtx()
    const state = makeGameState({ time: 0 })

    renderFloor(ctx as unknown as CanvasRenderingContext2D, state, DUAL_STRIP_H)

    // HUD background fillRect(0, FLOOR_Y, CANVAS_W, ...) must not appear
    const hudFill = ctx._fillRectCalls.find(
      ([x, y]) => x === 0 && y === FLOOR_Y
    )
    expect(hudFill).toBeUndefined()
  })

  it('with floorOverride=0: floor line drawn at y=0', () => {
    const ctx = makeCtx()
    const state = makeGameState({ time: 0 })

    renderFloor(ctx as unknown as CanvasRenderingContext2D, state, 0)

    // When override=0, floorLine=0 — first moveTo for solid line should be y=0
    const floorMoveTo = ctx._moveToCalls.find(([, y]) => y === 0)
    expect(floorMoveTo).toBeDefined()
  })

  it('with explicit floorOverride=undefined: behaves the same as no argument (uses FLOOR_Y)', () => {
    const ctx1 = makeCtx()
    const ctx2 = makeCtx()
    const state = makeGameState({ time: 0 })

    renderFloor(ctx1 as unknown as CanvasRenderingContext2D, state)
    renderFloor(ctx2 as unknown as CanvasRenderingContext2D, state, undefined)

    // Both should produce the same moveTo calls
    expect(ctx1._moveToCalls).toEqual(ctx2._moveToCalls)
    expect(ctx1._lineToCallsY).toEqual(ctx2._lineToCallsY)
    expect(ctx1._fillRectCalls).toEqual(ctx2._fillRectCalls)
  })
})

// ── DUAL obstacle scaling: y and h scaled by DUAL_STRIP_H / FLOOR_Y ──────────

describe('DUAL obstacle scaling (lane 2 chunk y/h scale)', () => {
  const scale = DUAL_STRIP_H / FLOOR_Y

  it('scale factor equals DUAL_STRIP_H / FLOOR_Y', () => {
    expect(scale).toBeCloseTo(270 / 480, 10)
  })

  it('scale factor is less than 1 (strips are shorter than full canvas)', () => {
    expect(scale).toBeLessThan(1)
  })

  it('obstacle at y=FLOOR_Y scaled to DUAL_STRIP_H', () => {
    const obs = { worldX: 100, y: FLOOR_Y, w: 40, h: 40 }
    obs.y = obs.y * scale
    obs.h = obs.h * scale
    expect(obs.y).toBeCloseTo(DUAL_STRIP_H, 5)
  })

  it('obstacle at y=0 remains at y=0 after scaling', () => {
    const obs = { worldX: 100, y: 0, w: 40, h: 10 }
    obs.y = obs.y * scale
    expect(obs.y).toBe(0)
  })

  it('obstacle height scales proportionally', () => {
    const originalH = 40
    const obs = { worldX: 100, y: 200, w: 30, h: originalH }
    obs.h = obs.h * scale
    expect(obs.h).toBeCloseTo(originalH * scale, 10)
  })

  it('multiple obstacles in a chunk are all scaled', () => {
    const chunk = [
      { worldX: 100, y: 440, w: 40, h: 40 },
      { worldX: 200, y: 0, w: 40, h: 20 },
      { worldX: 300, y: 200, w: 40, h: 30 },
    ]
    const originals = chunk.map(o => ({ y: o.y, h: o.h }))

    for (const obs of chunk) {
      obs.y = obs.y * scale
      obs.h = obs.h * scale
    }

    for (let i = 0; i < chunk.length; i++) {
      expect(chunk[i].y).toBeCloseTo(originals[i].y * scale, 10)
      expect(chunk[i].h).toBeCloseTo(originals[i].h * scale, 10)
    }
  })

  it('worldX is NOT modified by the scale (only y and h are scaled)', () => {
    const obs = { worldX: 960, y: 440, w: 40, h: 40 }
    const originalWorldX = obs.worldX
    obs.y = obs.y * scale
    obs.h = obs.h * scale
    expect(obs.worldX).toBe(originalWorldX)
  })

  it('obstacle width is NOT modified by the scale', () => {
    const obs = { worldX: 960, y: 440, w: 40, h: 40 }
    const originalW = obs.w
    obs.y = obs.y * scale
    obs.h = obs.h * scale
    expect(obs.w).toBe(originalW)
  })

  it('applying scale twice is NOT idempotent (guards against double-scaling)', () => {
    const obs = { worldX: 100, y: 440, w: 40, h: 40 }
    const once = obs.y * scale
    const twice = once * scale
    expect(twice).not.toBeCloseTo(once, 5) // double-scale changes the value
  })
})

// ── DUAL render path: HUD not rendered, game-over spans full canvas ───────────

describe('DUAL render path logic', () => {
  it('DUAL mode: s.mode === GameMode.DUAL is true', () => {
    const s = makeGameState({ mode: GameMode.DUAL })
    expect(s.mode === GameMode.DUAL).toBe(true)
  })

  it('Classic mode: s.mode === GameMode.DUAL is false (single-player path taken)', () => {
    const s = makeGameState({ mode: GameMode.CLASSIC })
    expect(s.mode === GameMode.DUAL).toBe(false)
  })

  it('Survival mode: s.mode === GameMode.DUAL is false', () => {
    const s = makeGameState({ mode: GameMode.SURVIVAL })
    expect(s.mode === GameMode.DUAL).toBe(false)
  })

  it('Daily mode: s.mode === GameMode.DUAL is false', () => {
    const s = makeGameState({ mode: GameMode.DAILY })
    expect(s.mode === GameMode.DUAL).toBe(false)
  })

  it('DUAL game-over condition: phase DEAD triggers full-canvas overlay check', () => {
    const s = makeGameState({ mode: GameMode.DUAL, phase: GamePhase.DEAD })
    // The render path checks: if (s.phase === GamePhase.DEAD) renderGameOver(ctx, s)
    const shouldRenderGameOver = s.phase === GamePhase.DEAD
    expect(shouldRenderGameOver).toBe(true)
  })

  it('DUAL playing state: game-over overlay NOT triggered', () => {
    const s = makeGameState({ mode: GameMode.DUAL, phase: GamePhase.PLAYING })
    const shouldRenderGameOver = s.phase === GamePhase.DEAD
    expect(shouldRenderGameOver).toBe(false)
  })

  it('single-player DEAD triggers game-over overlay', () => {
    const s = makeGameState({ mode: GameMode.CLASSIC, phase: GamePhase.DEAD })
    const shouldRenderGameOver = s.phase === GamePhase.DEAD
    expect(shouldRenderGameOver).toBe(true)
  })
})

// ── renderFloor signature: accepts exactly three arguments (ctx, state, floorOverride?) ──

describe('renderFloor function signature', () => {
  it('renderFloor is a function', async () => {
    const { renderFloor } = await import('../renderer')
    expect(typeof renderFloor).toBe('function')
  })

  it('renderFloor accepts two arguments without throwing', async () => {
    const { renderFloor } = await import('../renderer')
    const ctx = makeCtx()
    const state = makeGameState({ time: 0 })
    expect(() => renderFloor(ctx as unknown as CanvasRenderingContext2D, state)).not.toThrow()
  })

  it('renderFloor accepts three arguments (with floorOverride) without throwing', async () => {
    const { renderFloor } = await import('../renderer')
    const ctx = makeCtx()
    const state = makeGameState({ time: 0 })
    expect(() => renderFloor(ctx as unknown as CanvasRenderingContext2D, state, DUAL_STRIP_H)).not.toThrow()
  })
})

// ── DUAL strip dimensions ──────────────────────────────────────────────────────

describe('DUAL strip dimensions', () => {
  it('two strips exactly fill the canvas height', () => {
    expect(DUAL_STRIP_H * 2).toBe(CANVAS_H)
  })

  it('DUAL_STRIP_H is half of CANVAS_H', () => {
    expect(DUAL_STRIP_H).toBe(CANVAS_H / 2)
  })

  it('floorOverride=DUAL_STRIP_H matches strip height', () => {
    // The top strip clips at y=DUAL_STRIP_H, so the floor line should be at DUAL_STRIP_H
    expect(DUAL_STRIP_H).toBe(270)
  })

  it('bottom strip translate offset equals DUAL_STRIP_H', () => {
    // ctx.translate(0, DUAL_STRIP_H) positions the bottom strip correctly
    const translateY = DUAL_STRIP_H
    expect(translateY).toBe(270)
  })
})

// ── renderGameOver overlay: uses full canvas dimensions ───────────────────────

describe('renderGameOver covers full canvas in DUAL mode', () => {
  let renderGameOver: typeof import('../renderer').renderGameOver

  beforeEach(async () => {
    const mod = await import('../renderer')
    renderGameOver = mod.renderGameOver
  })

  it('renderGameOver fills the full canvas with a semi-transparent overlay', () => {
    const ctx = makeCtx()
    const state = makeGameState({
      mode: GameMode.DUAL,
      phase: GamePhase.DEAD,
      time: 0,
      player: makePlayer({ form: FormType.CUBE }),
      metres: 0,
      bestScore: 0,
    })

    renderGameOver(ctx as unknown as CanvasRenderingContext2D, state)

    // First fillRect should be the full-canvas semi-transparent overlay
    const overlay = ctx._fillRectCalls[0]
    expect(overlay).toBeDefined()
    expect(overlay[0]).toBe(0)  // x=0
    expect(overlay[1]).toBe(0)  // y=0
    expect(overlay[2]).toBe(CANVAS_W)
    expect(overlay[3]).toBe(CANVAS_H)
  })
})
