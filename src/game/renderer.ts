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
  FormType,
  FORM_COLOR,
  GameMode,
} from './constants'
import type { GameState, Obstacle, Particle } from './types'
import { isDailyDone, getBestScore } from './storage'

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
// floorOverride: when provided, draw floor line at this y instead of FLOOR_Y.
// Used for DUAL mode strips (each strip is 270px tall, so floorOverride = DUAL_STRIP_H).
export function renderFloor(ctx: CanvasRenderingContext2D, state: GameState, floorOverride?: number): void {
  const pulse = Math.sin(state.time * 2 * Math.PI * PULSE_HZ) * 0.5 + 0.5
  const floorLine = floorOverride ?? FLOOR_Y

  // HUD strip background — only render when not using a strip override
  if (floorOverride === undefined) {
    ctx.fillStyle = '#05050f'
    ctx.fillRect(0, FLOOR_Y, CANVAS_W, CANVAS_H - FLOOR_Y)
  }

  // Solid floor line
  ctx.strokeStyle = `rgba(0, 255, 255, ${0.6 + pulse * 0.4})`
  ctx.lineWidth = 2
  ctx.shadowColor = '#00ffff'
  ctx.shadowBlur = 4 + pulse * 12
  ctx.beginPath()
  ctx.moveTo(0, floorLine)
  ctx.lineTo(CANVAS_W, floorLine)
  ctx.stroke()
  ctx.shadowBlur = 0

  // Horizontal grid lines (below floor - decorative) with camera scroll
  const scrollOffset = (state.cameraX * 0.3) % GRID_LINE_SPACING
  for (let y = floorLine - GRID_LINE_SPACING - scrollOffset; y > 0; y -= GRID_LINE_SPACING) {
    const alpha = (0.04 + pulse * 0.06) * (1 - (floorLine - y) / floorLine)
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
    ctx.lineTo(x, floorLine)
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
      case ObstacleKind.LASER:
        renderLaser(ctx, sx, obs.y, obs.w, obs.h, obs.laserOn ?? true)
        break
      case ObstacleKind.PORTAL:
        if (obs.targetForm !== undefined) {
          renderPortal(ctx, sx, obs.y, obs.w, obs.h, obs.targetForm, time)
        }
        break
    }
  }
}

function renderSpike(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
): void {
  // Detect ceiling spike (y == 0) — flip triangle
  const isCeiling = y === 0

  ctx.save()
  ctx.fillStyle = '#ff2266'
  ctx.shadowColor = '#ff0044'
  ctx.shadowBlur = 8

  ctx.beginPath()
  if (isCeiling) {
    // Tip points down
    ctx.moveTo(x + w / 2, y + h)    // tip
    ctx.lineTo(x + w, y)             // top right
    ctx.lineTo(x, y)                 // top left
  } else {
    // Tip points up
    ctx.moveTo(x + w / 2, y)        // tip
    ctx.lineTo(x + w, y + h)        // bottom right
    ctx.lineTo(x, y + h)            // bottom left
  }
  ctx.closePath()
  ctx.fill()

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

  ctx.shadowColor = '#ff6600'
  ctx.shadowBlur = 10

  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fillStyle = '#cc3300'
  ctx.fill()

  ctx.strokeStyle = '#ff9900'
  ctx.lineWidth = 2
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6)
    ctx.lineTo(Math.cos(a) * (r + 8), Math.sin(a) * (r + 8))
    ctx.stroke()
  }

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

  ctx.fillRect(x, y, w, h)

  ctx.fillStyle = '#6688ff'
  ctx.fillRect(x, y, w, 3)

  ctx.shadowBlur = 0
  ctx.restore()
}

function renderLaser(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  on: boolean,
): void {
  if (!on) {
    // Dim off state — faint hint so player can see it's a laser
    ctx.save()
    ctx.globalAlpha = 0.2
    ctx.fillStyle = '#ff0000'
    ctx.fillRect(x, y, w, h)
    ctx.globalAlpha = 1
    ctx.restore()
    return
  }

  ctx.save()
  ctx.shadowColor = '#ff0000'
  ctx.shadowBlur = 20

  // Bright red core
  ctx.fillStyle = '#ff0000'
  ctx.fillRect(x, y, w, h)

  // Inner white-hot core
  ctx.fillStyle = '#ffaaaa'
  ctx.fillRect(x + w * 0.25, y, w * 0.5, h)

  ctx.shadowBlur = 0
  ctx.restore()
}

function renderPortal(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  targetForm: string,
  time: number,
): void {
  const color = FORM_COLOR[targetForm as keyof typeof FORM_COLOR] ?? '#ffffff'
  const pulse = Math.sin(time * 5) * 0.5 + 0.5

  ctx.save()
  ctx.shadowColor = color
  ctx.shadowBlur = 12 + pulse * 16

  // Portal body
  ctx.globalAlpha = 0.3 + pulse * 0.2
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)

  // Portal border
  ctx.globalAlpha = 0.8 + pulse * 0.2
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.strokeRect(x, y, w, h)

  // Form label inside portal
  ctx.globalAlpha = 0.9
  ctx.fillStyle = color
  ctx.font = 'bold 11px monospace'
  ctx.textAlign = 'center'
  ctx.shadowBlur = 6
  ctx.fillText(targetForm[0] ?? '', x + w / 2, y + h / 2 + 4)

  ctx.shadowBlur = 0
  ctx.globalAlpha = 1
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

  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.shadowColor = color
  ctx.shadowBlur = reached ? 16 : 8 + pulse * 8
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x, y + h)
  ctx.stroke()

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

// ── Player ─────────────────────────────────────────────────────────────────────
export function renderPlayer(ctx: CanvasRenderingContext2D, state: GameState): void {
  if (state.phase !== 'PLAYING') return

  const { player } = state
  const sx = PLAYER_SCREEN_X

  // Trail
  renderTrail(ctx, player.trail, player.form)

  switch (player.form) {
    case FormType.CUBE:
      renderCube(ctx, sx, player.y, player.rotation)
      break
    case FormType.SHIP:
      renderShip(ctx, sx, player.y)
      break
    case FormType.WAVE:
      renderWave(ctx, sx, player.y, state.time)
      break
    case FormType.BALL:
      renderBall(ctx, sx, player.y, player.gravSign, state.time)
      break
  }
}

function renderCube(
  ctx: CanvasRenderingContext2D,
  sx: number, y: number, rotation: number,
): void {
  ctx.save()
  ctx.translate(sx + PLAYER_SIZE / 2, y + PLAYER_SIZE / 2)
  ctx.rotate(rotation)

  ctx.shadowColor = '#00ffff'
  ctx.shadowBlur = 16

  ctx.fillStyle = '#00ddff'
  ctx.fillRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE)

  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.fillRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE * 0.5, PLAYER_SIZE * 0.5)

  ctx.strokeStyle = '#88ffff'
  ctx.lineWidth = 2
  ctx.strokeRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE)

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

function renderShip(
  ctx: CanvasRenderingContext2D,
  sx: number, y: number,
): void {
  ctx.save()
  ctx.translate(sx + PLAYER_SIZE / 2, y + PLAYER_SIZE / 2)

  ctx.shadowColor = '#ff2d78'
  ctx.shadowBlur = 18

  // Arrow / wedge shape pointing right
  ctx.fillStyle = '#ff2d78'
  ctx.beginPath()
  ctx.moveTo(PLAYER_SIZE / 2, 0)           // nose right
  ctx.lineTo(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2 + 4) // top-left wing
  ctx.lineTo(-PLAYER_SIZE / 4, 0)          // tail indent
  ctx.lineTo(-PLAYER_SIZE / 2, PLAYER_SIZE / 2 - 4)  // bottom-left wing
  ctx.closePath()
  ctx.fill()

  // Highlight
  ctx.fillStyle = 'rgba(255,160,200,0.4)'
  ctx.beginPath()
  ctx.moveTo(PLAYER_SIZE / 2, 0)
  ctx.lineTo(-PLAYER_SIZE / 4, -PLAYER_SIZE / 2 + 4)
  ctx.lineTo(-PLAYER_SIZE / 4, 0)
  ctx.closePath()
  ctx.fill()

  ctx.shadowBlur = 0
  ctx.restore()
}

function renderWave(
  ctx: CanvasRenderingContext2D,
  sx: number, y: number, time: number,
): void {
  ctx.save()
  ctx.translate(sx + PLAYER_SIZE / 2, y + PLAYER_SIZE / 2)

  const wobble = Math.sin(time * 12) * 3

  ctx.shadowColor = '#ffd700'
  ctx.shadowBlur = 16

  // Diamond / rhombus shape for WAVE
  ctx.fillStyle = '#ffd700'
  ctx.beginPath()
  ctx.moveTo(PLAYER_SIZE / 2, wobble)             // right
  ctx.lineTo(0, -PLAYER_SIZE / 2 + wobble)        // top
  ctx.lineTo(-PLAYER_SIZE / 2, wobble)            // left
  ctx.lineTo(0, PLAYER_SIZE / 2 + wobble)         // bottom
  ctx.closePath()
  ctx.fill()

  // Inner shine
  ctx.fillStyle = 'rgba(255,255,180,0.4)'
  ctx.beginPath()
  ctx.moveTo(PLAYER_SIZE / 4, wobble)
  ctx.lineTo(0, -PLAYER_SIZE / 4 + wobble)
  ctx.lineTo(-PLAYER_SIZE / 4, wobble)
  ctx.lineTo(0, PLAYER_SIZE / 4 + wobble)
  ctx.closePath()
  ctx.fill()

  ctx.shadowBlur = 0
  ctx.restore()
}

function renderBall(
  ctx: CanvasRenderingContext2D,
  sx: number, y: number, gravSign: number, time: number,
): void {
  ctx.save()
  ctx.translate(sx + PLAYER_SIZE / 2, y + PLAYER_SIZE / 2)

  const spin = time * (gravSign === 1 ? 3 : -3)

  ctx.shadowColor = '#39ff14'
  ctx.shadowBlur = 18

  // Circle
  ctx.fillStyle = '#39ff14'
  ctx.beginPath()
  ctx.arc(0, 0, PLAYER_SIZE / 2, 0, Math.PI * 2)
  ctx.fill()

  // Spin line to show direction
  ctx.strokeStyle = '#003300'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(Math.cos(spin) * PLAYER_SIZE * 0.35, Math.sin(spin) * PLAYER_SIZE * 0.35)
  ctx.stroke()

  // Shine
  ctx.fillStyle = 'rgba(200,255,180,0.4)'
  ctx.beginPath()
  ctx.arc(-PLAYER_SIZE * 0.15, -PLAYER_SIZE * 0.15, PLAYER_SIZE * 0.18, 0, Math.PI * 2)
  ctx.fill()

  ctx.shadowBlur = 0
  ctx.restore()
}

function renderTrail(
  ctx: CanvasRenderingContext2D,
  trail: Array<{ x: number; y: number }>,
  form: string,
): void {
  const color = FORM_COLOR[form as keyof typeof FORM_COLOR] ?? '#00ffff'
  for (let i = 0; i < trail.length; i++) {
    const t = trail[i]
    const alpha = (1 - i / trail.length) * 0.5
    const size = PLAYER_SIZE * (1 - (i / trail.length) * 0.4)
    ctx.globalAlpha = alpha
    ctx.fillStyle = color
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
  const hudY = FLOOR_Y
  const hudH = CANVAS_H - FLOOR_Y // 60px strip

  // HUD background
  ctx.fillStyle = '#05050f'
  ctx.fillRect(0, hudY, CANVAS_W, hudH)

  // Divider line
  ctx.strokeStyle = 'rgba(0,255,255,0.3)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, hudY)
  ctx.lineTo(CANVAS_W, hudY)
  ctx.stroke()

  // ── Top-left: form icon (24×24 colored square) ────────────────────────
  const formColor = FORM_COLOR[state.player.form]
  const iconX = 16
  const iconY = hudY + 10
  ctx.save()
  ctx.shadowColor = formColor
  ctx.shadowBlur = 8
  ctx.fillStyle = formColor
  ctx.fillRect(iconX, iconY, 24, 24)
  ctx.shadowBlur = 0
  ctx.restore()

  // ── Top-center: mode label ────────────────────────────────────────────
  let modeLabel = ''
  if (state.mode === GameMode.CLASSIC) {
    modeLabel = `CLASSIC L${state.currentLevel}`
  } else if (state.mode === GameMode.SURVIVAL) {
    modeLabel = 'SURVIVAL'
  } else if (state.mode === GameMode.DUAL) {
    modeLabel = 'DUAL'
  } else {
    modeLabel = 'DAILY'
  }
  ctx.save()
  ctx.font = 'bold 13px monospace'
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.textAlign = 'center'
  ctx.fillText(modeLabel, CANVAS_W / 2, hudY + 22)
  ctx.restore()

  // ── Top-right: progress (Classic = %) or distance (Survival/Daily = metres) ──
  let progressText = ''
  if (state.mode === GameMode.CLASSIC) {
    const progress = Math.min(state.player.worldX / LEVEL_LENGTH, 1)
    progressText = `${Math.floor(progress * 100)}%`
  } else {
    progressText = `${state.metres}m`
  }
  ctx.save()
  ctx.font = 'bold 14px monospace'
  ctx.fillStyle = '#00ffff'
  ctx.textAlign = 'right'
  ctx.shadowColor = '#00ffff'
  ctx.shadowBlur = 6
  ctx.fillText(progressText, CANVAS_W - 16, hudY + 22)
  ctx.shadowBlur = 0
  ctx.restore()

  // ── Bottom strip: score / attempt counter ─────────────────────────────
  ctx.save()
  ctx.font = '11px monospace'
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.textAlign = 'left'
  if (state.mode === GameMode.CLASSIC) {
    ctx.fillText(`attempt ${state.attempts}`, iconX, hudY + 48)
  } else {
    ctx.fillText(`score ${state.metres}m`, iconX, hudY + 48)
  }

  // Checkpoint indicator (Classic)
  if (state.checkpointReached && state.mode === GameMode.CLASSIC) {
    ctx.fillStyle = '#00ff88'
    ctx.textAlign = 'center'
    ctx.font = 'bold 11px monospace'
    ctx.fillText('✓ checkpoint', CANVAS_W / 2, hudY + 48)
  }
  ctx.restore()

  // ── Classic: progress bar ─────────────────────────────────────────────
  if (state.mode === GameMode.CLASSIC) {
    const progress = Math.min(state.player.worldX / LEVEL_LENGTH, 1)
    const barX = 50
    const barW = CANVAS_W - 180
    const barH = 6
    const barY = hudY + 32

    ctx.fillStyle = 'rgba(255,255,255,0.1)'
    ctx.fillRect(barX, barY, barW, barH)

    const fillGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0)
    fillGrad.addColorStop(0, '#00ffff')
    fillGrad.addColorStop(0.5, '#8800ff')
    fillGrad.addColorStop(1, '#ff00aa')
    ctx.fillStyle = fillGrad
    ctx.fillRect(barX, barY, barW * progress, barH)

    ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)'
    ctx.lineWidth = 1
    ctx.strokeRect(barX, barY, barW, barH)
  }
}

// ── Start Screen ──────────────────────────────────────────────────────────────
// Button layout (matching hit-test regions in useGameEngine.ts):
//   Classic:  x=380, y=246, w=200, h=48
//   Survival: x=380, y=314, w=200, h=48
//   Daily:    x=380, y=382, w=200, h=48
//   Dual:     x=380, y=450, w=200, h=48
export function renderStartScreen(ctx: CanvasRenderingContext2D, time: number): void {
  const cx = CANVAS_W / 2
  const pulse = Math.sin(time * 2) * 0.5 + 0.5

  ctx.save()

  // Title glow
  ctx.textAlign = 'center'
  ctx.font = 'bold 52px monospace'
  ctx.shadowColor = '#00ffff'
  ctx.shadowBlur = 30 + pulse * 20
  ctx.fillStyle = `rgba(0, 255, 255, ${0.9 + pulse * 0.1})`
  ctx.fillText('GEOMETRY', cx, 110)
  ctx.fillText('NEON RUSH', cx, 170)

  ctx.shadowBlur = 0
  ctx.restore()

  // Sub-title
  ctx.save()
  ctx.textAlign = 'center'
  ctx.font = '16px monospace'
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.fillText('SELECT MODE', cx, 220)
  ctx.restore()

  const dailyDone = isDailyDone()

  // Buttons
  drawButton(ctx, 380, 246, 200, 48, 'CLASSIC', '#00ffff', false, time)
  drawButton(ctx, 380, 314, 200, 48, 'SURVIVAL', '#ff2d78', false, time)
  drawButton(ctx, 380, 382, 200, 48, dailyDone ? 'Daily Done ✓' : 'DAILY', '#ffd700', dailyDone, time)
  drawButton(ctx, 380, 450, 200, 48, 'DUAL', '#cc44ff', false, time)

  // Footer hint (moved down to avoid overlap with DUAL button)
  ctx.save()
  ctx.textAlign = 'center'
  ctx.font = '12px monospace'
  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.fillText('Tap or click a mode to play', cx, 515)
  ctx.restore()
}

function drawButton(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  label: string,
  color: string,
  disabled: boolean,
  time: number,
): void {
  const pulse = Math.sin(time * 3) * 0.5 + 0.5
  const alpha = disabled ? 0.35 : 1

  ctx.save()
  ctx.globalAlpha = alpha

  // Border glow
  if (!disabled) {
    ctx.shadowColor = color
    ctx.shadowBlur = 8 + pulse * 8
  }

  // Background
  ctx.fillStyle = `rgba(10, 10, 30, 0.85)`
  ctx.fillRect(x, y, w, h)

  // Border
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.strokeRect(x, y, w, h)

  // Label
  ctx.font = 'bold 16px monospace'
  ctx.fillStyle = disabled ? 'rgba(200,200,200,0.5)' : color
  ctx.textAlign = 'center'
  ctx.shadowBlur = disabled ? 0 : 4
  ctx.fillText(label, x + w / 2, y + h / 2 + 6)

  ctx.shadowBlur = 0
  ctx.globalAlpha = 1
  ctx.restore()
}

// ── Game-Over Overlay ─────────────────────────────────────────────────────────
// Button layout (matching hit-test regions in useGameEngine.ts):
//   Retry: x=320, y=360, w=140, h=44
//   Menu:  x=500, y=360, w=140, h=44
export function renderGameOver(ctx: CanvasRenderingContext2D, state: GameState): void {
  // Semi-transparent overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.72)'
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  const cx = CANVAS_W / 2
  const pulse = Math.sin(state.time * 3) * 0.5 + 0.5

  // "DEAD" title
  ctx.save()
  ctx.textAlign = 'center'
  ctx.font = 'bold 64px monospace'
  ctx.shadowColor = '#ff0044'
  ctx.shadowBlur = 20 + pulse * 20
  ctx.fillStyle = '#ff2266'
  ctx.fillText('DEAD', cx, 160)
  ctx.shadowBlur = 0
  ctx.restore()

  // Form icon (24×24)
  const formColor = FORM_COLOR[state.player.form]
  ctx.save()
  ctx.shadowColor = formColor
  ctx.shadowBlur = 10
  ctx.fillStyle = formColor
  ctx.fillRect(cx - 12, 185, 24, 24)
  ctx.shadowBlur = 0
  ctx.restore()

  // Score
  const score = state.mode === GameMode.CLASSIC
    ? `${Math.floor(state.player.worldX / 80)}`
    : `${state.metres}m`

  // Best score (for Classic: load from localStorage, for survival/daily: use state.bestScore)
  const bestKey = state.mode === GameMode.CLASSIC
    ? `classic-l${state.currentLevel}`
    : state.mode === GameMode.SURVIVAL
      ? 'survival'
      : state.mode === GameMode.DUAL
        ? 'dual'
        : 'daily'
  const best = state.mode === GameMode.CLASSIC
    ? getBestScore(bestKey)
    : state.bestScore

  ctx.save()
  ctx.textAlign = 'center'
  ctx.font = 'bold 24px monospace'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(`Score: ${score}`, cx, 250)

  ctx.font = '16px monospace'
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  if (state.mode === GameMode.CLASSIC) {
    ctx.fillText(`Best: level ${best} cleared`, cx, 280)
  } else {
    ctx.fillText(`Best: ${best}m`, cx, 280)
  }
  ctx.restore()

  // Daily: one-attempt message instead of retry
  if (state.mode === GameMode.DAILY) {
    ctx.save()
    ctx.textAlign = 'center'
    ctx.font = '14px monospace'
    ctx.fillStyle = '#ffd700'
    ctx.fillText('Daily challenge done — come back tomorrow!', cx, 320)
    ctx.restore()

    // Only show Menu button for Daily
    drawButton(ctx, 410, 360, 140, 44, 'MENU', '#ffffff', false, state.time)
    return
  }

  // Retry and Menu buttons
  drawButton(ctx, 320, 360, 140, 44, 'RETRY', '#00ffff', false, state.time)
  drawButton(ctx, 500, 360, 140, 44, 'MENU', '#ffffff', false, state.time)
}

// ── Level Complete Overlay (Classic) ─────────────────────────────────────────
// Button layout (matching hit-test regions in useGameEngine.ts):
//   Next Level: x=360, y=330, w=200, h=44
//   Menu:       x=360, y=394, w=200, h=44
export function renderLevelCompleteOverlay(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.70)'
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  const cx = CANVAS_W / 2
  const pulse = Math.sin(state.time * 3) * 0.5 + 0.5

  ctx.save()
  ctx.textAlign = 'center'
  ctx.shadowColor = '#00ffff'
  ctx.shadowBlur = 20 + pulse * 20
  ctx.font = 'bold 58px monospace'
  ctx.fillStyle = `rgba(0, 255, 255, ${0.85 + pulse * 0.15})`
  ctx.fillText('LEVEL COMPLETE!', cx, 200)
  ctx.shadowBlur = 0
  ctx.restore()

  // Level number
  ctx.save()
  ctx.textAlign = 'center'
  ctx.font = '20px monospace'
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.fillText(`Level ${state.currentLevel} cleared`, cx, 248)
  ctx.restore()

  // Best time / first clear indicator
  const bestKey = `classic-l${state.currentLevel}`
  const best = getBestScore(bestKey)
  if (best > 0) {
    ctx.save()
    ctx.textAlign = 'center'
    ctx.font = '14px monospace'
    ctx.fillStyle = '#ffd700'
    ctx.shadowColor = '#ffd700'
    ctx.shadowBlur = 6
    ctx.fillText('NEW RECORD! Level cleared!', cx, 280)
    ctx.shadowBlur = 0
    ctx.restore()
  }

  const hasNext = state.currentLevel < 5
  drawButton(ctx, 360, 330, 200, 44, hasNext ? 'NEXT LEVEL' : 'PLAY AGAIN', '#00ffff', false, state.time)
  drawButton(ctx, 360, 394, 200, 44, 'MENU', '#ffffff', false, state.time)
}

// Keep the old renderLevelComplete for compatibility during transition
// (no longer called by useGameEngine — replaced by renderLevelCompleteOverlay)
export function renderLevelComplete(ctx: CanvasRenderingContext2D, time: number): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  const pulse = Math.sin(time * 3) * 0.5 + 0.5

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
  ctx.fillText('Press Space or tap to continue', CANVAS_W / 2, CANVAS_H / 2 + 30)

  ctx.shadowBlur = 0
  ctx.restore()
}
