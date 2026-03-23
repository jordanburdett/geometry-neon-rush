import {
  CANVAS_W,
  CANVAS_H,
  FLOOR_Y,
  PLAYER_SIZE,
  PLAYER_SCREEN_X,
  LEVEL_LENGTH,
  GRID_LINE_SPACING,
  PULSE_HZ,
  ObstacleKind,
} from './constants'
import type { GameState, Obstacle, Particle } from './types'

// ── Background + Starfield ────────────────────────────────────────────────────
export function renderBackground(ctx: CanvasRenderingContext2D, state: GameState): void {
  // Sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, FLOOR_Y)
  grad.addColorStop(0, '#0a0a1a')
  grad.addColorStop(1, '#0d0d2e')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, CANVAS_W, FLOOR_Y)

  // Stars
  ctx.save()
  for (const star of state.stars) {
    const alpha = star.brightness * (0.5 + 0.5 * Math.sin(state.time * 1.5 + star.x))
    ctx.globalAlpha = alpha
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  ctx.restore()
}

// ── Pulsing Grid Floor ────────────────────────────────────────────────────────
export function renderFloor(ctx: CanvasRenderingContext2D, state: GameState): void {
  const pulse = Math.sin(state.time * 2 * Math.PI * PULSE_HZ) * 0.5 + 0.5

  // HUD strip background
  ctx.fillStyle = '#05050f'
  ctx.fillRect(0, FLOOR_Y, CANVAS_W, CANVAS_H - FLOOR_Y)

  // Solid floor line
  ctx.strokeStyle = `rgba(0, 255, 255, ${0.6 + pulse * 0.4})`
  ctx.lineWidth = 2
  ctx.shadowColor = '#00ffff'
  ctx.shadowBlur = 4 + pulse * 12
  ctx.beginPath()
  ctx.moveTo(0, FLOOR_Y)
  ctx.lineTo(CANVAS_W, FLOOR_Y)
  ctx.stroke()
  ctx.shadowBlur = 0

  // Horizontal grid lines (below floor - decorative) with camera scroll
  const scrollOffset = (state.cameraX * 0.3) % GRID_LINE_SPACING
  for (let y = FLOOR_Y - GRID_LINE_SPACING - scrollOffset; y > 0; y -= GRID_LINE_SPACING) {
    const alpha = (0.04 + pulse * 0.06) * (1 - (FLOOR_Y - y) / FLOOR_Y)
    ctx.strokeStyle = `rgba(0, 200, 255, ${alpha})`
    ctx.lineWidth = 1
    ctx.shadowBlur = 0
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(CANVAS_W, y)
    ctx.stroke()
  }

  // Vertical grid lines (parallax scroll)
  const vOffset = (state.cameraX * 0.6) % GRID_LINE_SPACING
  for (let x = -vOffset; x < CANVAS_W; x += GRID_LINE_SPACING) {
    const alpha = 0.03 + pulse * 0.04
    ctx.strokeStyle = `rgba(80, 0, 200, ${alpha})`
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, FLOOR_Y)
    ctx.stroke()
  }
}

// ── Obstacles ─────────────────────────────────────────────────────────────────
export function renderObstacles(
  ctx: CanvasRenderingContext2D,
  obstacles: Obstacle[],
  cameraX: number,
  time: number,
): void {
  for (const obs of obstacles) {
    const sx = obs.worldX - cameraX

    // Frustum cull
    if (sx > CANVAS_W + 100 || sx + obs.w < -100) continue

    if (obs.isCheckpoint) {
      renderCheckpoint(ctx, sx, obs.y, obs.h, obs.reached ?? false, time)
      continue
    }

    switch (obs.kind) {
      case ObstacleKind.SPIKE:
        renderSpike(ctx, sx, obs.y, obs.w, obs.h)
        break
      case ObstacleKind.SAW:
        renderSaw(ctx, sx + obs.w / 2, obs.y + obs.h / 2, obs.w / 2, obs.angle ?? 0)
        break
      case ObstacleKind.PLATFORM:
        renderPlatform(ctx, sx, obs.y, obs.w, obs.h)
        break
    }
  }
}

function renderSpike(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
): void {
  ctx.save()
  ctx.fillStyle = '#ff2266'
  ctx.shadowColor = '#ff0044'
  ctx.shadowBlur = 8

  // Triangle pointing up
  ctx.beginPath()
  ctx.moveTo(x + w / 2, y)          // tip
  ctx.lineTo(x + w, y + h)          // bottom right
  ctx.lineTo(x, y + h)              // bottom left
  ctx.closePath()
  ctx.fill()

  // Highlight edge
  ctx.strokeStyle = '#ff88aa'
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.shadowBlur = 0
  ctx.restore()
}

function renderSaw(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number, angle: number,
): void {
  const spokes = 8

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(angle)

  // Outer glow
  ctx.shadowColor = '#ff6600'
  ctx.shadowBlur = 10

  // Disc
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fillStyle = '#cc3300'
  ctx.fill()

  // Teeth
  ctx.strokeStyle = '#ff9900'
  ctx.lineWidth = 2
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6)
    ctx.lineTo(Math.cos(a) * (r + 8), Math.sin(a) * (r + 8))
    ctx.stroke()
  }

  // Inner circle
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2)
  ctx.fillStyle = '#ff6600'
  ctx.fill()

  ctx.shadowBlur = 0
  ctx.restore()
}

function renderPlatform(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
): void {
  ctx.save()
  ctx.fillStyle = '#2244aa'
  ctx.shadowColor = '#4466ff'
  ctx.shadowBlur = 6

  // Platform body
  ctx.fillRect(x, y, w, h)

  // Top highlight
  ctx.fillStyle = '#6688ff'
  ctx.fillRect(x, y, w, 3)

  ctx.shadowBlur = 0
  ctx.restore()
}

function renderCheckpoint(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, h: number,
  reached: boolean,
  time: number,
): void {
  ctx.save()

  const pulse = Math.sin(time * 4) * 0.5 + 0.5
  const color = reached ? '#00ff88' : `rgba(255, 220, 0, ${0.7 + pulse * 0.3})`

  // Pole
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.shadowColor = color
  ctx.shadowBlur = reached ? 16 : 8 + pulse * 8
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x, y + h)
  ctx.stroke()

  // Flag
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + 24, y + 10)
  ctx.lineTo(x, y + 20)
  ctx.closePath()
  ctx.fill()

  ctx.shadowBlur = 0
  ctx.restore()
}

// ── Player (CUBE) ─────────────────────────────────────────────────────────────
export function renderPlayer(ctx: CanvasRenderingContext2D, state: GameState): void {
  if (state.phase !== 'PLAYING') return

  const { player } = state
  const sx = PLAYER_SCREEN_X

  // Trail
  renderTrail(ctx, player.trail)

  // Cube
  ctx.save()
  ctx.translate(sx + PLAYER_SIZE / 2, player.y + PLAYER_SIZE / 2)
  ctx.rotate(player.rotation)

  // Outer glow
  ctx.shadowColor = '#00ffff'
  ctx.shadowBlur = 16

  // Fill
  ctx.fillStyle = '#00ddff'
  ctx.fillRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE)

  // Inner highlight (top-left corner)
  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.fillRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE * 0.5, PLAYER_SIZE * 0.5)

  // Border
  ctx.strokeStyle = '#88ffff'
  ctx.lineWidth = 2
  ctx.strokeRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE)

  // Diagonal stripes
  ctx.strokeStyle = 'rgba(0, 80, 100, 0.5)'
  ctx.lineWidth = 1
  for (let i = -PLAYER_SIZE; i < PLAYER_SIZE * 2; i += 10) {
    ctx.beginPath()
    ctx.moveTo(-PLAYER_SIZE / 2 + i, -PLAYER_SIZE / 2)
    ctx.lineTo(-PLAYER_SIZE / 2 + i - PLAYER_SIZE, PLAYER_SIZE / 2)
    ctx.stroke()
  }

  ctx.shadowBlur = 0
  ctx.restore()
}

function renderTrail(
  ctx: CanvasRenderingContext2D,
  trail: Array<{ x: number; y: number }>,
): void {
  for (let i = 0; i < trail.length; i++) {
    const t = trail[i]
    const alpha = (1 - i / trail.length) * 0.5
    const size = PLAYER_SIZE * (1 - i / trail.length * 0.4)
    ctx.globalAlpha = alpha
    ctx.fillStyle = '#00ffff'
    ctx.fillRect(t.x, t.y, size, size)
  }
  ctx.globalAlpha = 1
}

// ── Particles ─────────────────────────────────────────────────────────────────
export function renderParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
  ctx.save()
  for (const p of particles) {
    const alpha = p.life / p.maxLife
    ctx.globalAlpha = alpha
    ctx.fillStyle = p.color
    ctx.shadowColor = p.color
    ctx.shadowBlur = 6
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
  }
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0
  ctx.restore()
}

// ── HUD ───────────────────────────────────────────────────────────────────────
export function renderHUD(ctx: CanvasRenderingContext2D, state: GameState): void {
  const progress = Math.min(state.player.worldX / LEVEL_LENGTH, 1)
  const pct = Math.floor(progress * 100)

  const hudY = FLOOR_Y + 8
  const barX = 20
  const barW = CANVAS_W - 180
  const barH = 12

  // Progress bar background
  ctx.fillStyle = 'rgba(255,255,255,0.1)'
  ctx.fillRect(barX, hudY + 8, barW, barH)

  // Progress bar fill
  const fillGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0)
  fillGrad.addColorStop(0, '#00ffff')
  fillGrad.addColorStop(0.5, '#8800ff')
  fillGrad.addColorStop(1, '#ff00aa')
  ctx.fillStyle = fillGrad
  ctx.fillRect(barX, hudY + 8, barW * progress, barH)

  // Bar border
  ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)'
  ctx.lineWidth = 1
  ctx.strokeRect(barX, hudY + 8, barW, barH)

  // Percent text
  ctx.font = 'bold 14px monospace'
  ctx.fillStyle = '#00ffff'
  ctx.textAlign = 'left'
  ctx.fillText(`${pct}%`, barX, hudY + 5)

  // Attempt counter
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '12px monospace'
  ctx.textAlign = 'right'
  ctx.fillText(`attempt ${state.attempts}`, CANVAS_W - 20, hudY + 20)

  // Checkpoint indicator
  if (state.checkpointReached) {
    ctx.fillStyle = '#00ff88'
    ctx.textAlign = 'right'
    ctx.font = 'bold 12px monospace'
    ctx.fillText('✓ checkpoint', CANVAS_W - 20, hudY + 6)
  }
}

// ── Level Complete Overlay ────────────────────────────────────────────────────
export function renderLevelComplete(ctx: CanvasRenderingContext2D, time: number): void {
  // Dim background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  const pulse = Math.sin(time * 3) * 0.5 + 0.5

  // Main text
  ctx.save()
  ctx.textAlign = 'center'
  ctx.shadowColor = '#00ffff'
  ctx.shadowBlur = 20 + pulse * 20
  ctx.font = 'bold 72px monospace'
  ctx.fillStyle = `rgba(0, 255, 255, ${0.85 + pulse * 0.15})`
  ctx.fillText('Level Complete!', CANVAS_W / 2, CANVAS_H / 2 - 30)

  ctx.shadowBlur = 10
  ctx.font = '28px monospace'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
  ctx.fillText('You crushed it!', CANVAS_W / 2, CANVAS_H / 2 + 30)

  ctx.shadowBlur = 0
  ctx.restore()
}
