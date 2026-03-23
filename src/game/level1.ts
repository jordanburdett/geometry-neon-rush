import type { Obstacle } from './types'
import { ObstacleKind, FLOOR_Y, CHECKPOINT_X } from './constants'

// Helper: create a spike (triangle) sitting on the floor
function spike(worldX: number, w = 36, h = 40): Obstacle {
  return {
    kind: ObstacleKind.SPIKE,
    worldX,
    y: FLOOR_Y - h,
    w,
    h,
  }
}

// Helper: create a tall spike
function tallSpike(worldX: number, w = 30, h = 60): Obstacle {
  return {
    kind: ObstacleKind.SPIKE,
    worldX,
    y: FLOOR_Y - h,
    w,
    h,
  }
}

// Helper: create a saw blade
function saw(worldX: number, y: number, r = 24): Obstacle {
  return {
    kind: ObstacleKind.SAW,
    worldX,
    y: y - r,
    w: r * 2,
    h: r * 2,
    angle: 0,
  }
}

// Helper: platform (jumpable-onto solid)
function platform(worldX: number, y: number, w: number, h = 18): Obstacle {
  return {
    kind: ObstacleKind.PLATFORM,
    worldX,
    y,
    w,
    h,
  }
}

// Helper: checkpoint flag
function checkpoint(worldX: number): Obstacle {
  return {
    kind: ObstacleKind.SPIKE, // reuse SPIKE for collision — but isCheckpoint overrides rendering
    worldX,
    y: FLOOR_Y - 80,
    w: 8,
    h: 80,
    isCheckpoint: true,
    reached: false,
  }
}

// Classic Level 1 — handcrafted layout
// Player starts at worldX=0. Level ends at x=8000.
// Difficulty ramps up: easy warm-up → rhythm section → checkpoint → harder combos → finale
export function buildLevel1(): Obstacle[] {
  const obs: Obstacle[] = []

  // ─── CHECKPOINT ─────────────────────────────────────────────────
  obs.push(checkpoint(CHECKPOINT_X))

  // ─── SECTION 1: Warm-up (x 1200–2200) ───────────────────────────
  // Simple single spikes
  obs.push(spike(1200))
  obs.push(spike(1500))
  obs.push(spike(1700))
  obs.push(spike(1900, 36, 40))
  obs.push(spike(2100))

  // ─── SECTION 2: First rhythm (x 2400–3200) ──────────────────────
  // Double spike pairs
  obs.push(spike(2400))
  obs.push(spike(2440))
  obs.push(spike(2640))
  obs.push(spike(2680))

  // Saw blade on floor level
  obs.push(saw(2900, FLOOR_Y))
  obs.push(saw(3050, FLOOR_Y))

  // Platform jump challenge
  obs.push(platform(3150, FLOOR_Y - 100, 80))
  obs.push(spike(3180, 80, 20)) // spike ON the platform top
  obs.push(spike(3350))
  obs.push(spike(3400))

  // ─── SECTION 3: Pre-checkpoint (x 3500–3950) ───────────────────
  // Trickier spacing
  obs.push(spike(3500))
  obs.push(spike(3600))
  obs.push(spike(3700))
  obs.push(saw(3800, FLOOR_Y))
  obs.push(spike(3900))

  // ─── CHECKPOINT at x=4000 ─────────────────────────────────────
  // (already added above)

  // ─── SECTION 4: Post-checkpoint (x 4200–5500) ──────────────────
  // Taller spikes appear
  obs.push(tallSpike(4200))
  obs.push(spike(4380))
  obs.push(tallSpike(4380 + 40))
  obs.push(spike(4560))
  obs.push(spike(4600))
  obs.push(spike(4640))

  // Saw gauntlet
  obs.push(saw(4800, FLOOR_Y))
  obs.push(saw(4920, FLOOR_Y))
  obs.push(saw(5040, FLOOR_Y))

  // Platform + spike combo
  obs.push(platform(5200, FLOOR_Y - 120, 100))
  obs.push(saw(5250, FLOOR_Y - 120 + 8)) // saw hovering just above platform top
  obs.push(spike(5400))
  obs.push(spike(5450))

  // ─── SECTION 5: Mid-game intensity (x 5600–6800) ────────────────
  // Rapid spike runs
  obs.push(spike(5600))
  obs.push(spike(5650))
  obs.push(spike(5700))
  obs.push(spike(5750))

  obs.push(saw(5900, FLOOR_Y))
  obs.push(saw(6020, FLOOR_Y))

  // Triple tall spike wall
  obs.push(tallSpike(6200))
  obs.push(tallSpike(6240))
  obs.push(tallSpike(6280))

  obs.push(platform(6450, FLOOR_Y - 80, 60))
  obs.push(spike(6460, 60, 20))
  obs.push(spike(6620))
  obs.push(spike(6660))
  obs.push(spike(6700))
  obs.push(spike(6740))

  obs.push(saw(6850, FLOOR_Y))

  // ─── SECTION 6: Finale (x 7000–7800) ────────────────────────────
  // Hardest section: mixed obstacles
  obs.push(spike(7000))
  obs.push(spike(7040))
  obs.push(spike(7080))
  obs.push(saw(7200, FLOOR_Y))
  obs.push(tallSpike(7300))
  obs.push(tallSpike(7340))
  obs.push(saw(7420, FLOOR_Y))
  obs.push(spike(7500))
  obs.push(spike(7540))
  obs.push(spike(7580))
  obs.push(saw(7680, FLOOR_Y))
  obs.push(tallSpike(7780))
  obs.push(tallSpike(7820))

  // Final clear run to 8000

  return obs
}
