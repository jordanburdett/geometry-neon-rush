import { useEffect, useRef, useCallback } from 'react'
import {
  CANVAS_W, CANVAS_H,
  PLAYER_SIZE, PLAYER_SCREEN_X, FLOOR_Y,
  STAR_LAYERS, TRAIL_LENGTH,
  SHAKE_DURATION, SHAKE_MAGNITUDE,
  GamePhase, GameMode,
  FormType,
  SCROLL_SPEED,
  SURVIVAL_SCALE_INTERVAL, SURVIVAL_SCALE_FACTOR,
  GRAVITY, SHIP_THRUST, SHIP_VY_MAX, WAVE_SPEED,
  DUAL_FLOOR_Y, DUAL_STRIP_H,
} from './game/constants'
import type { GameState, Star, Player } from './game/types'
import {
  tryJump, toggleWaveDir, flipBallGravity,
  updateTrail,
  checkObstacleCollisions, checkPortalCollision,
  spawnDeathParticles,
  updateParticles, updateObstacles, isLevelComplete,
} from './game/physics'
import {
  renderBackground, renderFloor, renderObstacles,
  renderPlayer, renderParticles, renderHUD,
  renderStartScreen, renderGameOver, renderLevelCompleteOverlay,
  renderGhostPlayer,
} from './game/renderer'
import { buildLevel1 } from './game/level1'
import { buildLevel2 } from './game/level2'
import { buildLevel3 } from './game/level3'
import { buildLevel4 } from './game/level4'
import { buildLevel5 } from './game/level5'
import { mulberry32, dailySeed } from './game/prng'
import {
  isDailyDone, markDailyDone, getBestScore, saveBestScore,
  saveGhostSurvivalIfBest, saveGhostClassicIfBest,
  lsGet,
} from './game/storage'
import type { GhostSample } from './game/storage'
import {
  pickChunk, injectDifficultyObstacles, chunkStartX,
} from './game/survivalChunks'

// ── Ghost data safe parser ────────────────────────────────────────────────────
function parseGhostData(raw: string | null): Array<{worldX: number, form: FormType}> | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as Array<{worldX: number, form: FormType}>
  } catch {
    return null
  }
}

// ── Level builder map ─────────────────────────────────────────────────────────
function buildLevel(level: number) {
  switch (level) {
    case 2: return buildLevel2()
    case 3: return buildLevel3()
    case 4: return buildLevel4()
    case 5: return buildLevel5()
    default: return buildLevel1()
  }
}

// ── Star factory ──────────────────────────────────────────────────────────────
function buildStars(): Star[] {
  const stars: Star[] = []
  for (const [speed, count] of STAR_LAYERS) {
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * CANVAS_W,
        y: Math.random() * FLOOR_Y,
        speed,
        size: speed === 100 ? 2 : speed === 50 ? 1.5 : 1,
        brightness: 0.4 + Math.random() * 0.6,
      })
    }
  }
  return stars
}

// ── Mode key for localStorage ─────────────────────────────────────────────────
function modeKey(mode: string, level: number): string {
  if (mode === GameMode.CLASSIC) return `classic-l${level}`
  if (mode === GameMode.SURVIVAL) return 'survival'
  if (mode === GameMode.DUAL) return 'dual'
  return 'daily'
}

// ── Initial state factory ─────────────────────────────────────────────────────
// chunkFloorOverride: when set, obstacle y-values in procedural chunks are
// proportionally scaled to fit a strip of this height instead of FLOOR_Y.
// Used for DUAL mode lane 2 (SHIP strip).
function buildInitialState(
  mode: typeof GameMode[keyof typeof GameMode] = GameMode.CLASSIC,
  level = 1,
  chunkFloorOverride?: number,
): GameState {
  const stars = buildStars()
  const best = getBestScore(modeKey(mode, level))

  const base: GameState = {
    phase: GamePhase.PLAYING,
    mode,
    player: {
      worldX: 0,
      y: FLOOR_Y - PLAYER_SIZE,
      vy: 0,
      onGround: true,
      form: 'CUBE',
      rotation: 0,
      gravSign: 1,
      waveDir: 'DOWN',
      trail: new Array(TRAIL_LENGTH).fill({ x: PLAYER_SCREEN_X, y: FLOOR_Y - PLAYER_SIZE }),
    },
    obstacles: [],
    particles: [],
    stars,
    cameraX: 0,
    checkpointReached: false,
    checkpointWorldX: 4000,
    shakeTimer: 0,
    shakeX: 0,
    shakeY: 0,
    time: 0,
    respawnTimer: 0,
    attempts: 1,
    currentLevel: level,
    inPortalIdx: -1,
    scrollSpeed: SCROLL_SPEED,
    runTime: 0,
    difficultyLevel: 0,
    nextChunkIndex: 0,
    rng: Math.random,
    metres: 0,
    bestScore: best,
  }

  if (mode === GameMode.CLASSIC) {
    base.obstacles = buildLevel(level)
    return base
  }

  // Survival / Daily — build initial chunks
  const rng = mode === GameMode.DAILY ? mulberry32(dailySeed()) : Math.random
  base.rng = rng
  base.obstacles = buildInitialChunks(rng, 0, 0, chunkFloorOverride)
  base.nextChunkIndex = 3 // we pre-build 3 chunks

  return base
}

// ── Survival: build N initial chunks ─────────────────────────────────────────
// floorOverride: if supplied, obstacle y-values are proportionally scaled from
// the full FLOOR_Y (480) coordinate space down to the target strip height.
// Used for DUAL mode lane 2 which runs in a 270px-tall strip.
function buildInitialChunks(
  rng: () => number,
  startChunkIndex: number,
  difficultyLevel: number,
  floorOverride?: number,
): import('./game/types').Obstacle[] {
  let obstacles: import('./game/types').Obstacle[] = []
  let lastId = ''
  for (let i = 0; i < 3; i++) {
    const chunkIdx = startChunkIndex + i
    const xOff = chunkStartX(chunkIdx)
    const tmpl = pickChunk(rng, difficultyLevel, lastId)
    lastId = tmpl.id
    const raw = tmpl.obstacles(xOff, rng)
    const withDifficulty = injectDifficultyObstacles(raw, xOff, difficultyLevel, rng)
    if (floorOverride !== undefined) {
      const scale = floorOverride / FLOOR_Y
      for (const obs of withDifficulty) {
        obs.y = obs.y * scale
        obs.h = obs.h * scale
      }
    }
    obstacles = obstacles.concat(withDifficulty)
  }
  return obstacles
}

// ── Start screen initial state (no obstacles, starfield only) ────────────────
function buildStartState(): GameState {
  return {
    phase: GamePhase.START,
    mode: GameMode.CLASSIC,
    player: {
      worldX: 0,
      y: FLOOR_Y - PLAYER_SIZE,
      vy: 0,
      onGround: true,
      form: 'CUBE',
      rotation: 0,
      gravSign: 1,
      waveDir: 'DOWN',
      trail: [],
    },
    obstacles: [],
    particles: [],
    stars: buildStars(),
    cameraX: 0,
    checkpointReached: false,
    checkpointWorldX: 4000,
    shakeTimer: 0,
    shakeX: 0,
    shakeY: 0,
    time: 0,
    respawnTimer: 0,
    attempts: 0,
    currentLevel: 1,
    inPortalIdx: -1,
    scrollSpeed: SCROLL_SPEED,
    runTime: 0,
    difficultyLevel: 0,
    nextChunkIndex: 0,
    rng: Math.random,
    metres: 0,
    bestScore: 0,
  }
}

// ── Button hit test ───────────────────────────────────────────────────────────
// Canvas is 960x540 rendered into a CSS-scaled element.
// We compute canvas coords from pointer event.
function canvasCoords(
  e: PointerEvent,
  canvas: HTMLCanvasElement,
): { cx: number; cy: number } {
  const rect = canvas.getBoundingClientRect()
  const scaleX = CANVAS_W / rect.width
  const scaleY = CANVAS_H / rect.height
  return {
    cx: (e.clientX - rect.left) * scaleX,
    cy: (e.clientY - rect.top) * scaleY,
  }
}

function hitTest(cx: number, cy: number, x: number, y: number, w: number, h: number): boolean {
  return cx >= x && cx <= x + w && cy >= y && cy <= y + h
}

// ── Survival: score in metres ─────────────────────────────────────────────────
function calcMetres(worldX: number): number {
  return Math.floor(worldX / 100)
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useGameEngine(canvasRef: React.RefObject<HTMLCanvasElement | null>): void {
  const stateRef = useRef<GameState>(buildStartState())
  const stateRef2 = useRef<GameState>(buildStartState())
  const jumpPressedRef = useRef(false)
  const holdingThrustRef = useRef(false)
  const currentLevelRef = useRef(1)
  // Track last chunk id for survival variety
  const lastChunkIdRef = useRef('')
  const lastChunkIdRef2 = useRef('')
  // DUAL death flash timer (0 = no flash, 0.4 = full flash)
  const dualDeathFlashRef = useRef(0)
  // Ghost recording — Survival and Classic only
  const ghostSamplesRef = useRef<GhostSample[]>([])
  const ghostLastSampleTimeRef = useRef<number>(0)
  // Ghost playback — loaded from localStorage on run start
  const ghostPlaybackRef = useRef<Array<{ worldX: number; form: string }> | null>(null)
  const ghostCursorIdxRef = useRef<number>(0)
  // Ghost delta HUD state
  const ghostDeltaRef = useRef<number>(0)         // metres delta (positive = ahead)
  const ghostOvertakeFlashRef = useRef<number>(0) // flash countdown timer (seconds)
  const ghostPrevDeltaRef = useRef<number>(0)     // previous frame delta for sign-flip detection

  const handleJumpStart = useCallback(() => {
    jumpPressedRef.current = true
    holdingThrustRef.current = true
  }, [])

  const handleJumpEnd = useCallback(() => {
    holdingThrustRef.current = false
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctxOrNull = canvas.getContext('2d')
    if (!ctxOrNull) return
    const ctx: CanvasRenderingContext2D = ctxOrNull

    // ── Level select helper ────────────────────────────────────────────────
    function loadLevel(level: number): void {
      currentLevelRef.current = level
      stateRef.current = buildInitialState(GameMode.CLASSIC, level)
      ghostSamplesRef.current = []
      ghostLastSampleTimeRef.current = 0
      // Load stored ghost for Classic level playback
      const raw = lsGet(`gnr-ghost-classic-l${level}`)
      ghostPlaybackRef.current = parseGhostData(raw)
      ghostCursorIdxRef.current = 0
      ghostDeltaRef.current = 0
      ghostOvertakeFlashRef.current = 0
      ghostPrevDeltaRef.current = 0
    }

    // ── Start a mode ──────────────────────────────────────────────────────
    function startMode(mode: typeof GameMode[keyof typeof GameMode]): void {
      if (mode === GameMode.DAILY && isDailyDone()) return // gate: one attempt
      stateRef.current = buildInitialState(mode, 1, mode === GameMode.DUAL ? DUAL_STRIP_H : undefined)
      currentLevelRef.current = 1
      lastChunkIdRef.current = ''
      ghostSamplesRef.current = []
      ghostLastSampleTimeRef.current = 0
      // Load stored ghost for playback
      if (mode === GameMode.SURVIVAL) {
        const raw = lsGet('gnr-ghost-survival')
        ghostPlaybackRef.current = parseGhostData(raw)
      } else if (mode === GameMode.CLASSIC) {
        const raw = lsGet('gnr-ghost-classic-l1')
        ghostPlaybackRef.current = parseGhostData(raw)
      } else {
        ghostPlaybackRef.current = null
      }
      ghostCursorIdxRef.current = 0
      ghostDeltaRef.current = 0
      ghostOvertakeFlashRef.current = 0
      ghostPrevDeltaRef.current = 0
      if (mode === GameMode.DUAL) {
        stateRef2.current = buildInitialState(GameMode.DUAL, 1, DUAL_STRIP_H)
        stateRef2.current.player.form = FormType.SHIP
        stateRef2.current.player.y = DUAL_FLOOR_Y
        lastChunkIdRef2.current = ''
        dualDeathFlashRef.current = 0
      } else {
        stateRef2.current = buildStartState()
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault()
        if (!e.repeat) {
          const s = stateRef.current
          if (s.phase === GamePhase.START) return // keyboard doesn't navigate start screen
          handleJumpStart()
        }
      }
      if (e.code === 'Escape') {
        stateRef.current = buildStartState()
        stateRef2.current = buildStartState()
      }
      // Level select keys 1-5 (Classic only)
      if (e.code === 'Digit1') loadLevel(1)
      if (e.code === 'Digit2') loadLevel(2)
      if (e.code === 'Digit3') loadLevel(3)
      if (e.code === 'Digit4') loadLevel(4)
      if (e.code === 'Digit5') loadLevel(5)
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        handleJumpEnd()
      }
    }

    // ── Pointer handling (canvas-space buttons) ────────────────────────────
    const onPointerDown = (e: PointerEvent) => {
      const s = stateRef.current
      const { cx, cy } = canvasCoords(e, canvas)

      if (s.phase === GamePhase.START) {
        // Start screen buttons (defined in renderer constants)
        // Classic button: centered at ~(480, 270), w=200, h=48
        if (hitTest(cx, cy, 380, 246, 200, 48)) { startMode(GameMode.CLASSIC); return }
        // Survival button
        if (hitTest(cx, cy, 380, 314, 200, 48)) { startMode(GameMode.SURVIVAL); return }
        // Daily button
        if (hitTest(cx, cy, 380, 382, 200, 48)) { startMode(GameMode.DAILY); return }
        // Dual button
        if (hitTest(cx, cy, 380, 450, 200, 48)) { startMode(GameMode.DUAL); return }
        return
      }

      if (s.phase === GamePhase.DEAD) {
        // Game-over screen: Retry / Menu
        // Retry button: (320, 360, 140, 44)
        if (hitTest(cx, cy, 320, 360, 140, 44)) {
          if (s.mode === GameMode.CLASSIC) {
            stateRef.current = buildInitialState(GameMode.CLASSIC, s.currentLevel)
          } else if (s.mode === GameMode.DAILY) {
            // Daily: already consumed the attempt, go to menu
            stateRef.current = buildStartState()
          } else if (s.mode === GameMode.DUAL) {
            stateRef.current = buildInitialState(GameMode.DUAL, 1, DUAL_STRIP_H)
            stateRef2.current = buildInitialState(GameMode.DUAL, 1, DUAL_STRIP_H)
            stateRef2.current.player.form = FormType.SHIP
            stateRef2.current.player.y = DUAL_FLOOR_Y
            lastChunkIdRef2.current = ''
            dualDeathFlashRef.current = 0
          } else {
            stateRef.current = buildInitialState(GameMode.SURVIVAL, 1)
          }
          lastChunkIdRef.current = ''
          ghostSamplesRef.current = []
          ghostLastSampleTimeRef.current = 0
          // Reload ghost for playback on retry
          if (s.mode === GameMode.SURVIVAL) {
            const raw = lsGet('gnr-ghost-survival')
            ghostPlaybackRef.current = parseGhostData(raw)
          } else if (s.mode === GameMode.CLASSIC) {
            const raw = lsGet(`gnr-ghost-classic-l${s.currentLevel}`)
            ghostPlaybackRef.current = parseGhostData(raw)
          } else {
            ghostPlaybackRef.current = null
          }
          ghostCursorIdxRef.current = 0
          ghostDeltaRef.current = 0
          ghostOvertakeFlashRef.current = 0
          ghostPrevDeltaRef.current = 0
          return
        }
        // Daily solo Menu button: (410, 360, 140, 44) — renderer centers it when Daily
        if (s.mode === GameMode.DAILY && hitTest(cx, cy, 410, 360, 140, 44)) {
          stateRef.current = buildStartState()
          return
        }
        // Menu button: (500, 360, 140, 44)
        if (hitTest(cx, cy, 500, 360, 140, 44)) {
          stateRef.current = buildStartState()
          stateRef2.current = buildStartState()
          return
        }
        return
      }

      if (s.phase === GamePhase.LEVEL_COMPLETE) {
        // Next Level button: (360, 330, 200, 44)
        if (hitTest(cx, cy, 360, 330, 200, 44)) {
          const nextLevel = s.currentLevel < 5 ? s.currentLevel + 1 : 1
          stateRef.current = buildInitialState(GameMode.CLASSIC, nextLevel)
          currentLevelRef.current = nextLevel
          ghostSamplesRef.current = []
          ghostLastSampleTimeRef.current = 0
          // Load ghost for next level
          const raw = lsGet(`gnr-ghost-classic-l${nextLevel}`)
          ghostPlaybackRef.current = parseGhostData(raw)
          ghostCursorIdxRef.current = 0
          ghostDeltaRef.current = 0
          ghostOvertakeFlashRef.current = 0
          ghostPrevDeltaRef.current = 0
          return
        }
        // Menu button: (360, 394, 200, 44)
        if (hitTest(cx, cy, 360, 394, 200, 44)) {
          stateRef.current = buildStartState()
          return
        }
        return
      }

      // PLAYING phase
      handleJumpStart()
    }

    const onPointerUp = () => handleJumpEnd()

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointerleave', onPointerUp)

    let animId: number
    let lastTime = 0

    const loop = (ts: number) => {
      const dt = Math.min((ts - lastTime) / 1000, 0.05)
      lastTime = ts

      update(dt)
      render()

      animId = requestAnimationFrame(loop)
    }

    // ── UPDATE ──────────────────────────────────────────────────────────────
    function update(dt: number): void {
      const s = stateRef.current
      s.time += dt

      const jumpPressed = jumpPressedRef.current
      jumpPressedRef.current = false

      // ── START phase: animate starfield only ─────────────────────────────
      if (s.phase === GamePhase.START) {
        for (const star of s.stars) {
          star.x -= star.speed * dt
          if (star.x < 0) {
            star.x = CANVAS_W + Math.random() * 10
            star.y = Math.random() * FLOOR_Y
          }
        }
        return
      }

      // ── DEAD phase: particles + shake only (no auto-respawn) ────────────
      if (s.phase === GamePhase.DEAD) {
        updateParticles(s.particles, dt)
        if (s.shakeTimer > 0) {
          s.shakeTimer -= dt
          s.shakeX = (Math.random() - 0.5) * SHAKE_MAGNITUDE * 2
          s.shakeY = (Math.random() - 0.5) * SHAKE_MAGNITUDE * 2
        } else {
          s.shakeX = 0
          s.shakeY = 0
        }
        // Decay DUAL death flash
        if (dualDeathFlashRef.current > 0) {
          dualDeathFlashRef.current = Math.max(0, dualDeathFlashRef.current - dt)
        }
        return
      }

      // ── LEVEL_COMPLETE phase: particles only (wait for button press) ────
      if (s.phase === GamePhase.LEVEL_COMPLETE) {
        updateParticles(s.particles, dt)
        return
      }

      // ── COMPLETE phase (Classic): advance to next level ─────────────────
      if (s.phase === GamePhase.COMPLETE) {
        updateParticles(s.particles, dt)
        if (jumpPressed) {
          const nextLevel = s.currentLevel < 5 ? s.currentLevel + 1 : 1
          stateRef.current = buildInitialState(GameMode.CLASSIC, nextLevel)
          currentLevelRef.current = nextLevel
        }
        return
      }

      // ── PLAYING ────────────────────────────────────────────────────────

      // Survival / Daily: update run time + difficulty scaling
      if (s.mode !== GameMode.CLASSIC) {
        s.runTime += dt
        const newDifficultyLevel = Math.floor(s.runTime / SURVIVAL_SCALE_INTERVAL)
        if (newDifficultyLevel > s.difficultyLevel) {
          s.difficultyLevel = newDifficultyLevel
          s.scrollSpeed = SCROLL_SPEED * Math.pow(1 + SURVIVAL_SCALE_FACTOR, s.difficultyLevel)
        }
        s.metres = calcMetres(s.player.worldX)
      }

      // Handle input per form
      if (jumpPressed) {
        switch (s.player.form) {
          case FormType.CUBE:
            tryJump(s.player)
            break
          case FormType.WAVE:
            toggleWaveDir(s.player)
            break
          case FormType.BALL:
            flipBallGravity(s.player)
            break
          // SHIP: handled via holdingThrust (continuous)
        }
      }

      // Update physics per form (pass scrollSpeed for survival modes)
      // In DUAL mode, lane 1 is always CUBE and uses the 270px strip bounds.
      const speed = s.scrollSpeed
      const dualFloor = s.mode === GameMode.DUAL ? DUAL_FLOOR_Y : undefined
      switch (s.player.form) {
        case FormType.CUBE:
          updateCubeWithSpeed(s.player, dt, speed, dualFloor)
          break
        case FormType.SHIP:
          updateShipWithSpeed(s.player, dt, holdingThrustRef.current, speed, dualFloor)
          break
        case FormType.WAVE:
          updateWaveWithSpeed(s.player, dt, speed, dualFloor)
          break
        case FormType.BALL:
          updateBallWithSpeed(s.player, dt, speed, dualFloor)
          break
      }

      updateObstacles(s.obstacles, dt, s.time)

      // Update camera
      s.cameraX = Math.max(0, s.player.worldX - PLAYER_SCREEN_X)

      // Update trail
      updateTrail(s.player, PLAYER_SCREEN_X)

      // Update stars (parallax)
      for (const star of s.stars) {
        star.x -= star.speed * dt
        if (star.x < 0) {
          star.x = CANVAS_W + Math.random() * 10
          star.y = Math.random() * FLOOR_Y
        }
      }

      // Shake
      if (s.shakeTimer > 0) {
        s.shakeTimer -= dt
        s.shakeX = (Math.random() - 0.5) * SHAKE_MAGNITUDE * 2
        s.shakeY = (Math.random() - 0.5) * SHAKE_MAGNITUDE * 2
      } else {
        s.shakeX = 0
        s.shakeY = 0
      }

      updateParticles(s.particles, dt)

      // ── Ghost recording (Survival + Classic only, ~10Hz) ──────────────────
      if (s.mode !== GameMode.DAILY && s.mode !== GameMode.DUAL) {
        const sampleClock = s.mode === GameMode.CLASSIC ? s.time : s.runTime
        if (sampleClock - ghostLastSampleTimeRef.current >= 0.1) {
          ghostLastSampleTimeRef.current = sampleClock
          ghostSamplesRef.current.push({ worldX: s.player.worldX, form: s.player.form })
          if (ghostSamplesRef.current.length > 600) ghostSamplesRef.current.shift()
        }
      }

      // ── Ghost cursor advancement (worldX-based, not time-based) ───────────
      const ghost = ghostPlaybackRef.current
      if (ghost && ghost.length > 0) {
        const liveX = s.player.worldX
        while (
          ghostCursorIdxRef.current < ghost.length - 1 &&
          ghost[ghostCursorIdxRef.current + 1].worldX <= liveX
        ) {
          ghostCursorIdxRef.current++
        }
      }

      // ── Ghost delta HUD (Survival + Classic only; ghost null guards DUAL/DAILY) ──
      if (ghost && ghost.length > 0) {
        const ghostWorldX = ghost[ghostCursorIdxRef.current].worldX
        const prevDelta = ghostPrevDeltaRef.current
        const liveDelta = s.player.worldX - ghostWorldX // positive = ahead
        ghostDeltaRef.current = liveDelta
        // Detect overtake: was behind (≤0), now ahead (>0)
        if (prevDelta <= 0 && liveDelta > 0) {
          ghostOvertakeFlashRef.current = 0.8
        }
        ghostPrevDeltaRef.current = liveDelta
        // Decrement flash timer
        if (ghostOvertakeFlashRef.current > 0) {
          ghostOvertakeFlashRef.current = Math.max(0, ghostOvertakeFlashRef.current - dt)
        }
      }

      // ── Survival: advance chunks ─────────────────────────────────────────
      if (s.mode !== GameMode.CLASSIC) {
        advanceSurvivalChunks(s)
      }

      // ── Portal collision ─────────────────────────────────────────────────
      const portalIdx = checkPortalCollision(s.player, s.obstacles, s.cameraX)
      if (portalIdx !== -1 && portalIdx !== s.inPortalIdx) {
        const portalObs = s.obstacles[portalIdx]
        if (portalObs.targetForm !== undefined) {
          s.player.form = portalObs.targetForm
          s.player.vy = 0
          s.player.gravSign = 1
          s.player.waveDir = 'DOWN'
        }
        s.inPortalIdx = portalIdx
      } else if (portalIdx === -1) {
        s.inPortalIdx = -1
      }

      // ── Classic: check level complete ────────────────────────────────────
      if (s.mode === GameMode.CLASSIC && isLevelComplete(s.player)) {
        s.phase = GamePhase.LEVEL_COMPLETE
        // Save best score (for Classic, score = percent * 100 effectively level completion)
        const score = s.currentLevel
        saveBestScore(modeKey(s.mode, s.currentLevel), score)
        // Ghost: save Classic run if it's the first completion or a new best time
        saveGhostClassicIfBest(s.currentLevel, s.time, ghostSamplesRef.current)
        return
      }

      // ── Check obstacle collisions ────────────────────────────────────────
      const collisionResult = checkObstacleCollisions(s.player, s.obstacles, s.cameraX)
      if (collisionResult === 'dead') {
        const screenX = PLAYER_SCREEN_X
        spawnDeathParticles(screenX, s.player.y, s.particles)
        s.shakeTimer = SHAKE_DURATION
        s.phase = GamePhase.DEAD

        // Save score on death
        const score = s.mode === GameMode.CLASSIC
          ? Math.floor(s.player.worldX / 80)
          : s.metres
        const mk = modeKey(s.mode, s.currentLevel)
        saveBestScore(mk, score)
        s.bestScore = getBestScore(mk)

        // Daily: mark as done on first death
        if (s.mode === GameMode.DAILY) {
          markDailyDone(s.metres)
        }

        // Ghost: save Survival run if it's a new best
        if (s.mode === GameMode.SURVIVAL) {
          saveGhostSurvivalIfBest(s.metres, ghostSamplesRef.current)
        }
      } else if (collisionResult === 'checkpoint') {
        s.checkpointReached = true
        s.checkpointWorldX = 4000
      }

      // ── DUAL: run second state update pass ───────────────────────────────
      if (s.mode === GameMode.DUAL) {
        const s2 = stateRef2.current
        if (s.phase === GamePhase.DEAD) {
          // Lane 1 just died (or was already dead) — immediately kill lane 2 without
          // running another physics tick for it.
          const wasAlive = s2.phase !== GamePhase.DEAD
          s2.phase = GamePhase.DEAD
          if (wasAlive) {
            dualDeathFlashRef.current = 0.4
          }
        } else {
          updateDualLane(dt, holdingThrustRef.current)

          // Mutual death: if lane 2 just died, kill lane 1 too
          // (s.phase is guaranteed non-DEAD here — the outer guard handles the reverse)
          if (s2.phase === GamePhase.DEAD) {
            spawnDeathParticles(PLAYER_SCREEN_X, s.player.y, s.particles)
            s.shakeTimer = SHAKE_DURATION
            s.phase = GamePhase.DEAD
            dualDeathFlashRef.current = 0.4
          }
        }
      }
    }

    // ── DUAL: update the second lane (SHIP) ──────────────────────────────────
    function updateDualLane(dt: number, holdingThrust: boolean): void {
      const s2 = stateRef2.current
      if (s2.phase !== GamePhase.PLAYING) return

      s2.time += dt

      // Difficulty scaling (mirrors lane 1)
      s2.runTime += dt
      const newDiff = Math.floor(s2.runTime / SURVIVAL_SCALE_INTERVAL)
      if (newDiff > s2.difficultyLevel) {
        s2.difficultyLevel = newDiff
        s2.scrollSpeed = SCROLL_SPEED * Math.pow(1 + SURVIVAL_SCALE_FACTOR, s2.difficultyLevel)
      }
      s2.metres = calcMetres(s2.player.worldX)

      // SHIP form: no jump event needed, thrust is continuous
      updateShipWithSpeed(s2.player, dt, holdingThrust, s2.scrollSpeed, DUAL_FLOOR_Y)

      updateObstacles(s2.obstacles, dt, s2.time)

      s2.cameraX = Math.max(0, s2.player.worldX - PLAYER_SCREEN_X)

      updateTrail(s2.player, PLAYER_SCREEN_X)

      // Stars are shared from state1 — no separate star update needed

      // Shake
      if (s2.shakeTimer > 0) {
        s2.shakeTimer -= dt
        s2.shakeX = (Math.random() - 0.5) * SHAKE_MAGNITUDE * 2
        s2.shakeY = (Math.random() - 0.5) * SHAKE_MAGNITUDE * 2
      } else {
        s2.shakeX = 0
        s2.shakeY = 0
      }

      updateParticles(s2.particles, dt)

      // Advance chunks for lane 2
      advanceSurvivalChunksLane2(s2)

      // Collision check for lane 2
      const col2 = checkObstacleCollisions(s2.player, s2.obstacles, s2.cameraX)
      if (col2 === 'dead') {
        spawnDeathParticles(PLAYER_SCREEN_X, s2.player.y, s2.particles)
        s2.shakeTimer = SHAKE_DURATION
        s2.phase = GamePhase.DEAD
        const mk = modeKey(GameMode.DUAL, 1)
        saveBestScore(mk, s2.metres)
        s2.bestScore = getBestScore(mk)
      }

      // Desync: after 30s, bottom lane cameraX advances faster
      if (stateRef.current.runTime > 30) {
        s2.cameraX += 100 * dt
      }
    }

    // ── Survival chunk advancement ─────────────────────────────────────────
    function advanceSurvivalChunks(s: GameState): void {
      // Remove obstacles that are well behind the camera (> 1 chunk behind)
      const removeThreshold = s.cameraX - CANVAS_W
      for (let i = s.obstacles.length - 1; i >= 0; i--) {
        if (s.obstacles[i].worldX + 100 < removeThreshold) {
          s.obstacles.splice(i, 1)
        }
      }

      // Add new chunk when camera approaches the frontier
      const frontierX = s.nextChunkIndex * (CANVAS_W)
      const bufferAhead = CANVAS_W * 2
      if (s.player.worldX + bufferAhead > frontierX) {
        const xOff = chunkStartX(s.nextChunkIndex)
        const tmpl = pickChunk(s.rng, s.difficultyLevel, lastChunkIdRef.current)
        lastChunkIdRef.current = tmpl.id
        const raw = tmpl.obstacles(xOff, s.rng)
        const newChunk = injectDifficultyObstacles(raw, xOff, s.difficultyLevel, s.rng)
        if (s.mode === GameMode.DUAL) {
          const scale = DUAL_STRIP_H / FLOOR_Y
          for (const obs of newChunk) {
            obs.y = obs.y * scale
            obs.h = obs.h * scale
          }
        }
        s.obstacles.push(...newChunk)
        s.nextChunkIndex++
      }
    }

    // ── Survival chunk advancement — lane 2 (DUAL mode) ───────────────────
    function advanceSurvivalChunksLane2(s: GameState): void {
      const removeThreshold = s.cameraX - CANVAS_W
      for (let i = s.obstacles.length - 1; i >= 0; i--) {
        if (s.obstacles[i].worldX + 100 < removeThreshold) {
          s.obstacles.splice(i, 1)
        }
      }

      const frontierX = s.nextChunkIndex * CANVAS_W
      const bufferAhead = CANVAS_W * 2
      if (s.player.worldX + bufferAhead > frontierX) {
        const xOff = chunkStartX(s.nextChunkIndex)
        const tmpl = pickChunk(s.rng, s.difficultyLevel, lastChunkIdRef2.current)
        lastChunkIdRef2.current = tmpl.id
        const raw = tmpl.obstacles(xOff, s.rng)
        const newChunk = injectDifficultyObstacles(raw, xOff, s.difficultyLevel, s.rng)
        const scale = DUAL_STRIP_H / FLOOR_Y
        for (const obs of newChunk) {
          obs.y = obs.y * scale
          obs.h = obs.h * scale
        }
        s.obstacles.push(...newChunk)
        s.nextChunkIndex++
      }
    }

    // ── RENDER ──────────────────────────────────────────────────────────────
    function render(): void {
      const s = stateRef.current

      ctx.save()

      if (s.shakeX !== 0 || s.shakeY !== 0) {
        ctx.translate(s.shakeX, s.shakeY)
      }

      ctx.clearRect(-SHAKE_MAGNITUDE, -SHAKE_MAGNITUDE, CANVAS_W + SHAKE_MAGNITUDE * 2, CANVAS_H + SHAKE_MAGNITUDE * 2)

      if (s.phase === GamePhase.START) {
        renderBackground(ctx, s)
        renderStartScreen(ctx, s.time)
        ctx.restore()
        return
      }

      // ── DUAL mode: two clipped strips ─────────────────────────────────────
      if (s.mode === GameMode.DUAL) {
        const s2 = stateRef2.current

        // Compute SYNC gap for readout
        const syncGap = Math.abs(s2.cameraX - s.cameraX)
        const syncText = 'SYNC ' + Math.floor(syncGap) + 'px'

        // Top strip — CUBE (stateRef)
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, 0, CANVAS_W, DUAL_STRIP_H)
        ctx.clip()
        renderBackground(ctx, s)
        renderFloor(ctx, s, DUAL_STRIP_H)
        renderObstacles(ctx, s.obstacles, s.cameraX, s.time)
        renderPlayer(ctx, s)
        renderParticles(ctx, s.particles)
        // SYNC readout — top strip
        ctx.font = '9px monospace'
        ctx.fillStyle = '#cc44ff'
        ctx.textAlign = 'right'
        ctx.shadowColor = '#cc44ff'
        ctx.shadowBlur = 4
        ctx.fillText(syncText, CANVAS_W - 8, 16)
        ctx.shadowBlur = 0
        ctx.restore()

        // Bottom strip — SHIP (stateRef2)
        ctx.save()
        ctx.translate(0, DUAL_STRIP_H)
        ctx.beginPath()
        ctx.rect(0, 0, CANVAS_W, DUAL_STRIP_H)
        ctx.clip()
        renderBackground(ctx, s2)
        renderFloor(ctx, s2, DUAL_STRIP_H)
        renderObstacles(ctx, s2.obstacles, s2.cameraX, s2.time)
        renderPlayer(ctx, s2)
        renderParticles(ctx, s2.particles)
        // SYNC readout — bottom strip
        ctx.font = '9px monospace'
        ctx.fillStyle = '#cc44ff'
        ctx.textAlign = 'right'
        ctx.shadowColor = '#cc44ff'
        ctx.shadowBlur = 4
        ctx.fillText(syncText, CANVAS_W - 8, 16)
        ctx.shadowBlur = 0
        ctx.restore()

        // Neon divider line at y = DUAL_STRIP_H
        ctx.save()
        ctx.strokeStyle = '#cc44ff'
        ctx.lineWidth = 3
        ctx.shadowColor = '#cc44ff'
        ctx.shadowBlur = 12
        ctx.beginPath()
        ctx.moveTo(0, DUAL_STRIP_H)
        ctx.lineTo(CANVAS_W, DUAL_STRIP_H)
        ctx.stroke()
        ctx.shadowBlur = 0
        ctx.restore()

        // Form-indicator icons
        // Top-left of top strip: CUBE (cyan)
        ctx.save()
        ctx.fillStyle = '#00ffff'
        ctx.shadowColor = '#00ffff'
        ctx.shadowBlur = 8
        ctx.fillRect(8, 8, 16, 16)
        ctx.shadowBlur = 0
        ctx.font = '9px monospace'
        ctx.fillStyle = '#00ffff'
        ctx.textAlign = 'left'
        ctx.fillText('CUBE', 8, 36)
        ctx.restore()

        // Top-left of bottom strip: SHIP (magenta) — canvas pos y = DUAL_STRIP_H + 8 = 278
        ctx.save()
        ctx.fillStyle = '#ff2d78'
        ctx.shadowColor = '#ff2d78'
        ctx.shadowBlur = 8
        ctx.fillRect(8, DUAL_STRIP_H + 8, 16, 16)
        ctx.shadowBlur = 0
        ctx.font = '9px monospace'
        ctx.fillStyle = '#ff2d78'
        ctx.textAlign = 'left'
        ctx.fillText('SHIP', 8, DUAL_STRIP_H + 36)
        ctx.restore()

        // Death flash (before game-over overlay so flash fades then game-over appears)
        if (dualDeathFlashRef.current > 0) {
          const flashAlpha = (dualDeathFlashRef.current / 0.4) * 0.5
          // Top strip: cyan flash
          ctx.save()
          ctx.beginPath()
          ctx.rect(0, 0, CANVAS_W, DUAL_STRIP_H)
          ctx.clip()
          ctx.fillStyle = `rgba(0,255,255,${flashAlpha})`
          ctx.fillRect(0, 0, CANVAS_W, DUAL_STRIP_H)
          ctx.restore()
          // Bottom strip: magenta flash
          ctx.save()
          ctx.translate(0, DUAL_STRIP_H)
          ctx.beginPath()
          ctx.rect(0, 0, CANVAS_W, DUAL_STRIP_H)
          ctx.clip()
          ctx.fillStyle = `rgba(255,45,120,${flashAlpha})`
          ctx.fillRect(0, 0, CANVAS_W, DUAL_STRIP_H)
          ctx.restore()
        }

        // Game-over overlay spans the full canvas when either lane is dead
        if (s.phase === GamePhase.DEAD) {
          renderGameOver(ctx, s)
        }

        ctx.restore()
        return
      }

      // ── Single-player modes ────────────────────────────────────────────────
      renderBackground(ctx, s)
      renderFloor(ctx, s)
      renderObstacles(ctx, s.obstacles, s.cameraX, s.time)
      renderPlayer(ctx, s)
      // Ghost playback: render after live player so ghost appears on top
      const ghostPlayback = ghostPlaybackRef.current
      if (ghostPlayback && ghostPlayback.length > 0 && s.phase === GamePhase.PLAYING) {
        const sample = ghostPlayback[ghostCursorIdxRef.current]
        if (sample) {
          renderGhostPlayer(ctx, { worldX: sample.worldX, form: sample.form as FormType }, s.cameraX, s.player.y)
        }
      }
      renderParticles(ctx, s.particles)
      // Pass ghost delta to HUD only during active play (not over overlays) when ghost is loaded
      const ghostDeltaOpts = (s.phase === GamePhase.PLAYING && ghostPlaybackRef.current !== null) ? {
        delta: ghostDeltaRef.current,
        flashActive: ghostOvertakeFlashRef.current > 0,
        time: s.time
      } : null
      renderHUD(ctx, s, ghostDeltaOpts)

      if (s.phase === GamePhase.DEAD) {
        renderGameOver(ctx, s)
      }

      if (s.phase === GamePhase.LEVEL_COMPLETE) {
        renderLevelCompleteOverlay(ctx, s)
      }

      ctx.restore()
    }

    animId = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointerleave', onPointerUp)
    }
  }, [canvasRef, handleJumpStart, handleJumpEnd])
}

// ── Physics wrappers with variable scroll speed ───────────────────────────────
// These mirror the original physics functions but accept a custom scrollSpeed.
// The originals use the constant SCROLL_SPEED; survival needs scaling.

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
