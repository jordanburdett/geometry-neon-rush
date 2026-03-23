import { useEffect, useRef, useCallback } from 'react'
import {
  CANVAS_W, CANVAS_H,
  PLAYER_SIZE, PLAYER_SCREEN_X, FLOOR_Y,
  STAR_LAYERS, TRAIL_LENGTH,
  SHAKE_DURATION, SHAKE_MAGNITUDE,
  GamePhase,
} from './game/constants'
import type { GameState, Star } from './game/types'
import {
  updateCube, tryJump, updateTrail,
  checkObstacleCollisions, spawnDeathParticles,
  updateParticles, respawnPlayer, updateObstacles, isLevelComplete,
} from './game/physics'
import {
  renderBackground, renderFloor, renderObstacles,
  renderPlayer, renderParticles, renderHUD, renderLevelComplete,
} from './game/renderer'
import { buildLevel1 } from './game/level1'

// ── Initial state factory ─────────────────────────────────────────────────────
function buildInitialState(): GameState {
  // Build starfield
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

  return {
    phase: GamePhase.PLAYING,
    player: {
      worldX: 0,
      y: FLOOR_Y - PLAYER_SIZE,
      vy: 0,
      onGround: true,
      form: 'CUBE',
      rotation: 0,
      trail: new Array(TRAIL_LENGTH).fill({ x: PLAYER_SCREEN_X, y: FLOOR_Y - PLAYER_SIZE }),
    },
    obstacles: buildLevel1(),
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
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useGameEngine(canvasRef: React.RefObject<HTMLCanvasElement | null>): void {
  const stateRef = useRef<GameState>(buildInitialState())
  const jumpPressedRef = useRef(false)

  // Input handlers
  const handleJump = useCallback(() => {
    jumpPressedRef.current = true
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctxOrNull = canvas.getContext('2d')
    if (!ctxOrNull) return
    const ctx: CanvasRenderingContext2D = ctxOrNull

    // Attach input listeners
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault()
        handleJump()
      }
    }
    const onPointerDown = () => handleJump()

    window.addEventListener('keydown', onKeyDown)
    canvas.addEventListener('pointerdown', onPointerDown)

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

      // Handle jump input
      if (jumpPressedRef.current) {
        jumpPressedRef.current = false
        if (s.phase === GamePhase.PLAYING) {
          tryJump(s.player)
        } else if (s.phase === GamePhase.COMPLETE) {
          // Restart on complete
          stateRef.current = buildInitialState()
          return
        }
      }

      if (s.phase === GamePhase.DEAD) {
        // Countdown to respawn
        s.respawnTimer -= dt
        updateParticles(s.particles, dt)
        // Shake
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
        return
      }

      // ── PLAYING ────────────────────────────────────────────────────────────
      updateCube(s.player, dt)
      updateObstacles(s.obstacles, dt)

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

      // Update particles
      updateParticles(s.particles, dt)

      // Check level complete
      if (isLevelComplete(s.player)) {
        s.phase = GamePhase.COMPLETE
        return
      }

      // Check collisions
      const collisionResult = checkObstacleCollisions(s.player, s.obstacles, s.cameraX)
      if (collisionResult === 'dead') {
        // Death sequence
        const screenX = PLAYER_SCREEN_X
        spawnDeathParticles(screenX, s.player.y, s.particles)
        s.shakeTimer = SHAKE_DURATION
        s.phase = GamePhase.DEAD
        s.respawnTimer = SHAKE_DURATION + 0.1 // slight extra delay after shake
      } else if (collisionResult === 'checkpoint') {
        s.checkpointReached = true
        s.checkpointWorldX = 4000
      }
    }

    // ── RENDER ──────────────────────────────────────────────────────────────
    function render(): void {
      const s = stateRef.current

      ctx.save()

      // Screen shake offset
      if (s.shakeX !== 0 || s.shakeY !== 0) {
        ctx.translate(s.shakeX, s.shakeY)
      }

      // Clear
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
      canvas.removeEventListener('pointerdown', onPointerDown)
    }
  }, [canvasRef, handleJump])
}
