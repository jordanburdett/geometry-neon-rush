import {
  GRAVITY,
  JUMP_VY,
  SCROLL_SPEED,
  PLAYER_SIZE,
  FLOOR_Y,
  LEVEL_LENGTH,
  PARTICLE_COUNT,
  PARTICLE_LIFETIME,
  SHIP_THRUST,
  SHIP_VY_MAX,
  WAVE_SPEED,
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

// ── Raw AABB (no mercy shrink) — used for portals ────────────────────────────
export function aabbRaw(
  px: number, py: number, pw: number, ph: number,
  ox: number, oy: number, ow: number, oh: number,
): boolean {
  return px < ox + ow && px + pw > ox && py < oy + oh && py + ph > oy
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

// ── Update SHIP physics ───────────────────────────────────────────────────────
// holdingThrust: true while Space/tap is held
export function updateShip(player: Player, dt: number, holdingThrust: boolean): void {
  if (holdingThrust) {
    player.vy -= SHIP_THRUST * dt
  } else {
    player.vy += GRAVITY * dt
  }

  // Clamp vy
  if (player.vy < -SHIP_VY_MAX) player.vy = -SHIP_VY_MAX
  if (player.vy > SHIP_VY_MAX) player.vy = SHIP_VY_MAX

  // Move vertically
  player.y += player.vy * dt

  // Advance world position
  player.worldX += SCROLL_SPEED * dt

  // Ceiling clamp
  if (player.y < 0) {
    player.y = 0
    player.vy = 0
  }

  // Floor clamp
  if (player.y >= FLOOR_Y - PLAYER_SIZE) {
    player.y = FLOOR_Y - PLAYER_SIZE
    player.vy = 0
  }
}

// ── Update WAVE physics ───────────────────────────────────────────────────────
// No gravity. Taps toggle direction.
export function updateWave(player: Player, dt: number): void {
  player.vy = player.waveDir === 'UP' ? -WAVE_SPEED : WAVE_SPEED

  player.y += player.vy * dt
  player.worldX += SCROLL_SPEED * dt

  // Ceiling clamp
  if (player.y < 0) {
    player.y = 0
    player.waveDir = 'DOWN'
  }

  // Floor clamp
  if (player.y >= FLOOR_Y - PLAYER_SIZE) {
    player.y = FLOOR_Y - PLAYER_SIZE
    player.waveDir = 'UP'
  }
}

// ── Toggle WAVE direction (on tap) ────────────────────────────────────────────
export function toggleWaveDir(player: Player): void {
  player.waveDir = player.waveDir === 'UP' ? 'DOWN' : 'UP'
}

// ── Update BALL physics ───────────────────────────────────────────────────────
export function updateBall(player: Player, dt: number): void {
  player.vy += GRAVITY * player.gravSign * dt

  player.y += player.vy * dt
  player.worldX += SCROLL_SPEED * dt

  // Ceiling snap (inverted gravity)
  if (player.y < 0) {
    player.y = 0
    player.vy = 0
  }

  // Floor snap (normal gravity)
  if (player.y >= FLOOR_Y - PLAYER_SIZE) {
    player.y = FLOOR_Y - PLAYER_SIZE
    player.vy = 0
  }
}

// ── Flip BALL gravity ─────────────────────────────────────────────────────────
export function flipBallGravity(player: Player): void {
  player.gravSign = player.gravSign === 1 ? -1 : 1
  // Give a small velocity push in the new direction for snappier feel
  player.vy = 0
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

    // Skip platforms and portals (not lethal)
    if (obs.kind === ObstacleKind.PLATFORM) continue
    if (obs.kind === ObstacleKind.PORTAL) continue

    // Skip reached checkpoints
    if (obs.isCheckpoint && obs.reached) continue

    // Lasers: no mercy shrink (instant kill on any contact)
    if (obs.kind === ObstacleKind.LASER) {
      if (obs.laserOn !== false) {
        // Only kill when laser is visually on
        if (
          aabbRaw(
            screenX, player.y, PLAYER_SIZE, PLAYER_SIZE,
            obsScreenX, obs.y, obs.w, obs.h,
          )
        ) {
          return 'dead'
        }
      }
      continue
    }

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

// ── Check portal collisions → return portal index or -1 ──────────────────────
export function checkPortalCollision(
  player: Player,
  obstacles: Obstacle[],
  cameraX: number,
): number {
  const screenX = player.worldX - cameraX

  for (let i = 0; i < obstacles.length; i++) {
    const obs = obstacles[i]
    if (obs.kind !== ObstacleKind.PORTAL) continue

    const obsScreenX = obs.worldX - cameraX
    if (obsScreenX > 1000 || obsScreenX + obs.w < -200) continue

    if (
      aabbRaw(
        screenX, player.y, PLAYER_SIZE, PLAYER_SIZE,
        obsScreenX, obs.y, obs.w, obs.h,
      )
    ) {
      return i
    }
  }

  return -1
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
  state.player.gravSign = 1
  state.player.waveDir = 'DOWN'
  state.player.trail = []
  // Reset form to CUBE on respawn from start, keep current form if checkpoint
  if (!state.checkpointReached) {
    state.player.form = 'CUBE'
  }
  state.cameraX = Math.max(0, spawnX - 100)
  state.phase = GamePhase.PLAYING
  state.attempts++
  state.inPortalIdx = -1
}

// ── Update obstacles (saws, moving platforms, laser flicker) ──────────────────
export function updateObstacles(obstacles: Obstacle[], dt: number, time: number): void {
  for (const obs of obstacles) {
    // Saw rotation
    if (obs.kind === ObstacleKind.SAW && obs.angle !== undefined) {
      obs.angle += 3 * dt // ~170 deg/s
    }

    // Moving platform/obstacle: sinusoidal horizontal motion
    if (obs.moving) {
      obs.worldX = obs.moving.baseX + obs.moving.amplitude * Math.sin(time * obs.moving.freq)
    }

    // Laser flicker at 3Hz (toggle every ~0.33s)
    if (obs.kind === ObstacleKind.LASER) {
      if (obs.laserOn === undefined) obs.laserOn = true
      if (obs.laserTimer === undefined) obs.laserTimer = 0
      obs.laserTimer += dt
      if (obs.laserTimer >= 1 / 3) {
        obs.laserTimer -= 1 / 3
        obs.laserOn = !obs.laserOn
      }
    }
  }
}

// ── Check level complete ──────────────────────────────────────────────────────
export function isLevelComplete(player: Player): boolean {
  return player.worldX >= LEVEL_LENGTH
}
