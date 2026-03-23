import {
  GRAVITY,
  JUMP_VY,
  SCROLL_SPEED,
  PLAYER_SIZE,
  FLOOR_Y,
  LEVEL_LENGTH,
  PARTICLE_COUNT,
  PARTICLE_LIFETIME,
  GamePhase,
  ObstacleKind,
} from './constants'
import type { Player, Obstacle, Particle, GameState } from './types'

// ── AABB collision with 80% mercy shrink ──────────────────────────────────────
// Returns true if player overlaps obstacle
// Player hitbox is inset by 10% each side (horizontal) and 10% top
export function aabbCollision(
  px: number, py: number, pw: number, ph: number,
  ox: number, oy: number, ow: number, oh: number,
): boolean {
  const pLeft   = px + pw * 0.1
  const pRight  = px + pw * 0.9
  const pTop    = py + ph * 0.1
  const pBottom = py + ph

  return pLeft < ox + ow && pRight > ox && pTop < oy + oh && pBottom > oy
}

// ── Update CUBE physics ───────────────────────────────────────────────────────
export function updateCube(player: Player, dt: number): void {
  // Gravity
  player.vy += GRAVITY * dt

  // Move vertically
  player.y += player.vy * dt

  // Advance world position
  player.worldX += SCROLL_SPEED * dt

  // Floor clamp
  if (player.y >= FLOOR_Y - PLAYER_SIZE) {
    player.y = FLOOR_Y - PLAYER_SIZE
    player.vy = 0
    player.onGround = true
  } else {
    player.onGround = false
  }

  // Cube rotation (visual only, rotates while airborne, snaps when grounded)
  if (!player.onGround) {
    player.rotation += 4 * dt // ~230 deg/s
  } else {
    // Snap to nearest 90 degrees
    const snap = Math.round(player.rotation / (Math.PI / 2)) * (Math.PI / 2)
    player.rotation += (snap - player.rotation) * Math.min(dt * 20, 1)
  }
}

// ── Jump ─────────────────────────────────────────────────────────────────────
export function tryJump(player: Player): void {
  if (player.onGround) {
    player.vy = JUMP_VY
    player.onGround = false
  }
}

// ── Update trail ──────────────────────────────────────────────────────────────
// screenX = player screen position (PLAYER_SCREEN_X)
export function updateTrail(player: Player, screenX: number): void {
  player.trail.unshift({ x: screenX, y: player.y })
  if (player.trail.length > 15) {
    player.trail.pop()
  }
}

// ── Check obstacles for collision/checkpoint ─────────────────────────────────
// Returns: 'dead' | 'checkpoint' | null
export function checkObstacleCollisions(
  player: Player,
  obstacles: Obstacle[],
  cameraX: number,
): 'dead' | 'checkpoint' | null {
  const screenX = player.worldX - cameraX

  for (const obs of obstacles) {
    const obsScreenX = obs.worldX - cameraX

    // Skip obstacles far off screen
    if (obsScreenX > 1000 || obsScreenX + obs.w < -200) continue

    // Checkpoint detection (generous trigger zone)
    if (obs.isCheckpoint && !obs.reached) {
      if (Math.abs(player.worldX - obs.worldX) < 60) {
        obs.reached = true
        return 'checkpoint'
      }
      continue
    }

    // Skip platforms for now (they only block from above — handled in updateCube via floor snap)
    if (obs.kind === ObstacleKind.PLATFORM) continue

    // Skip reached checkpoints
    if (obs.isCheckpoint && obs.reached) continue

    if (
      aabbCollision(
        screenX, player.y, PLAYER_SIZE, PLAYER_SIZE,
        obsScreenX, obs.y, obs.w, obs.h,
      )
    ) {
      return 'dead'
    }
  }

  return null
}

// ── Spawn death particles ─────────────────────────────────────────────────────
export function spawnDeathParticles(
  x: number,
  y: number,
  particles: Particle[],
): void {
  const colors = ['#00ffff', '#ff00ff', '#ffff00', '#ff6600', '#ffffff']
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = (i / PARTICLE_COUNT) * Math.PI * 2
    const speed = 150 + Math.random() * 200
    particles.push({
      x: x + PLAYER_SIZE / 2,
      y: y + PLAYER_SIZE / 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 100,
      life: PARTICLE_LIFETIME,
      maxLife: PARTICLE_LIFETIME,
      color: colors[i % colors.length],
      size: 4 + Math.random() * 4,
    })
  }
}

// ── Update particles ──────────────────────────────────────────────────────────
export function updateParticles(particles: Particle[], dt: number): void {
  for (const p of particles) {
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vy += GRAVITY * 0.5 * dt // half gravity on particles
    p.life -= dt
  }
  // Remove dead particles
  for (let i = particles.length - 1; i >= 0; i--) {
    if (particles[i].life <= 0) {
      particles.splice(i, 1)
    }
  }
}

// ── Respawn player ────────────────────────────────────────────────────────────
export function respawnPlayer(state: GameState): void {
  const spawnX = state.checkpointReached ? state.checkpointWorldX : 0
  state.player.worldX = spawnX
  state.player.y = FLOOR_Y - PLAYER_SIZE
  state.player.vy = 0
  state.player.onGround = true
  state.player.rotation = 0
  state.player.trail = []
  state.cameraX = Math.max(0, spawnX - 100)
  state.phase = GamePhase.PLAYING
  state.attempts++
}

// ── Update saw blade rotation ─────────────────────────────────────────────────
export function updateObstacles(obstacles: Obstacle[], dt: number): void {
  for (const obs of obstacles) {
    if (obs.kind === ObstacleKind.SAW && obs.angle !== undefined) {
      obs.angle += 3 * dt // ~170 deg/s
    }
  }
}

// ── Check level complete ──────────────────────────────────────────────────────
export function isLevelComplete(player: Player): boolean {
  return player.worldX >= LEVEL_LENGTH
}
