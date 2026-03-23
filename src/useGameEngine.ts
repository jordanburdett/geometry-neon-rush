import { useEffect, useRef, useCallback } from 'react'
import {
  CANVAS_W, CANVAS_H,
  PLAYER_SIZE, PLAYER_SCREEN_X, FLOOR_Y,
  STAR_LAYERS, TRAIL_LENGTH,
  SHAKE_DURATION, SHAKE_MAGNITUDE,
  GamePhase,
  FormType,
} from './game/constants'
import type { GameState, Star } from './game/types'
import {
  updateCube, updateShip, updateWave, updateBall,
  tryJump, toggleWaveDir, flipBallGravity,
  updateTrail,
  checkObstacleCollisions, checkPortalCollision,
  spawnDeathParticles,
  updateParticles, respawnPlayer, updateObstacles, isLevelComplete,
} from './game/physics'
import {
  renderBackground, renderFloor, renderObstacles,
  renderPlayer, renderParticles, renderHUD, renderLevelComplete,
} from './game/renderer'
import { buildLevel1 } from './game/level1'
import { buildLevel2 } from './game/level2'
import { buildLevel3 } from './game/level3'
import { buildLevel4 } from './game/level4'
import { buildLevel5 } from './game/level5'

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

// ── Initial state factory ─────────────────────────────────────────────────────
function buildInitialState(level = 1): GameState {
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

  // Level 4 starts as SHIP immediately (portal at x=1100)
  // Level 5 starts as CUBE
  const startForm: typeof FormType[keyof typeof FormType] = 'CUBE'

  return {
    phase: GamePhase.PLAYING,
    player: {
      worldX: 0,
      y: FLOOR_Y - PLAYER_SIZE,
      vy: 0,
      onGround: true,
      form: startForm,
      rotation: 0,
      gravSign: 1,
      waveDir: 'DOWN',
      trail: new Array(TRAIL_LENGTH).fill({ x: PLAYER_SCREEN_X, y: FLOOR_Y - PLAYER_SIZE }),
    },
    obstacles: buildLevel(level),
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
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useGameEngine(canvasRef: React.RefObject<HTMLCanvasElement | null>): void {
  const stateRef = useRef<GameState>(buildInitialState())
  // jumpPressed: tap once → true for one frame (CUBE jump, WAVE toggle, BALL flip)
  const jumpPressedRef = useRef(false)
  // holdingThrust: true while Space/pointer held (SHIP thrust)
  const holdingThrustRef = useRef(false)
  // Level selector (keyboard 1-5)
  const currentLevelRef = useRef(1)

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

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault()
        if (!e.repeat) {
          handleJumpStart()
        }
      }
      // Level select keys 1-5
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

    const onPointerDown = () => handleJumpStart()
    const onPointerUp = () => handleJumpEnd()

    function loadLevel(level: number): void {
      currentLevelRef.current = level
      stateRef.current = buildInitialState(level)
    }

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

      if (s.phase === GamePhase.DEAD) {
        s.respawnTimer -= dt
        updateParticles(s.particles, dt)
        if (s.shakeTimer > 0) {
          s.shakeTimer -= dt
          s.shakeX = (Math.random() - 0.5) * SHAKE_MAGNITUDE * 2
          s.shakeY = (Math.random() - 0.5) * SHAKE_MAGNITUDE * 2
        } else {
          s.shakeX = 0
          s.shakeY = 0
        }
        if (s.respawnTimer <= 0) {
          respawnPlayer(s)
        }
        return
      }

      if (s.phase === GamePhase.COMPLETE) {
        updateParticles(s.particles, dt)
        if (jumpPressed) {
          // Advance to next level or restart
          const nextLevel = s.currentLevel < 5 ? s.currentLevel + 1 : 1
          stateRef.current = buildInitialState(nextLevel)
          currentLevelRef.current = nextLevel
        }
        return
      }

      // ── PLAYING ────────────────────────────────────────────────────────────

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

      // Update physics per form
      switch (s.player.form) {
        case FormType.CUBE:
          updateCube(s.player, dt)
          break
        case FormType.SHIP:
          updateShip(s.player, dt, holdingThrustRef.current)
          break
        case FormType.WAVE:
          updateWave(s.player, dt)
          break
        case FormType.BALL:
          updateBall(s.player, dt)
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

      // ── Portal collision ────────────────────────────────────────────────────
      const portalIdx = checkPortalCollision(s.player, s.obstacles, s.cameraX)
      if (portalIdx !== -1 && portalIdx !== s.inPortalIdx) {
        // Switch form
        const portalObs = s.obstacles[portalIdx]
        if (portalObs.targetForm !== undefined) {
          s.player.form = portalObs.targetForm
          // Reset form-specific state
          s.player.vy = 0
          s.player.gravSign = 1
          s.player.waveDir = 'DOWN'
        }
        s.inPortalIdx = portalIdx
      } else if (portalIdx === -1) {
        // Cleared portal — reset guard
        s.inPortalIdx = -1
      }

      // Check level complete
      if (isLevelComplete(s.player)) {
        s.phase = GamePhase.COMPLETE
        return
      }

      // Check obstacle collisions
      const collisionResult = checkObstacleCollisions(s.player, s.obstacles, s.cameraX)
      if (collisionResult === 'dead') {
        const screenX = PLAYER_SCREEN_X
        spawnDeathParticles(screenX, s.player.y, s.particles)
        s.shakeTimer = SHAKE_DURATION
        s.phase = GamePhase.DEAD
        s.respawnTimer = SHAKE_DURATION + 0.1
      } else if (collisionResult === 'checkpoint') {
        s.checkpointReached = true
        s.checkpointWorldX = 4000
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

      renderBackground(ctx, s)
      renderFloor(ctx, s)
      renderObstacles(ctx, s.obstacles, s.cameraX, s.time)
      renderPlayer(ctx, s)
      renderParticles(ctx, s.particles)
      renderHUD(ctx, s)

      if (s.phase === GamePhase.COMPLETE) {
        renderLevelComplete(ctx, s.time)
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
