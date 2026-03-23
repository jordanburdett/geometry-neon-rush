// Classic Level 2 — CUBE → SHIP → CUBE
// Introduces: laser walls, form-gate portals
// Length: 8000px, checkpoint at x=4000
import type { Obstacle } from './types'
import { FLOOR_Y } from './constants'
import {
  spike, tallSpike, saw, laser, portal, checkpoint, platform,
} from './levelHelpers'

export function buildLevel2(): Obstacle[] {
  const obs: Obstacle[] = []

  obs.push(checkpoint(4000))

  // ─── SECTION 1: CUBE warm-up (x 1200–2400) ──────────────────────
  obs.push(spike(1200))
  obs.push(spike(1400))
  obs.push(spike(1600))
  obs.push(spike(1750))
  obs.push(spike(1900))
  obs.push(spike(2100))
  obs.push(spike(2200))
  obs.push(spike(2350))

  // ─── PORTAL 1: CUBE → SHIP at x=2500 ────────────────────────────
  // Portal is a tall gateway spanning mid-play-area
  obs.push(portal(2500, FLOOR_Y - 200, 50, 200, 'SHIP'))

  // ─── SECTION 2: SHIP gauntlet (x 2700–3900) ─────────────────────
  // Laser walls with gaps — SHIP must weave between ceiling and floor
  // Narrow vertical corridors: spike on floor + spike on ceiling at same x
  obs.push(spike(2700))           // floor spike to dodge up
  // Ceiling spike pair
  obs.push({ kind: 'SPIKE' as const, worldX: 2850, y: 0, w: 36, h: 40 })
  obs.push({ kind: 'SPIKE' as const, worldX: 2890, y: 0, w: 36, h: 40 })

  obs.push(laser(3050))           // first laser — fly over it via timing
  obs.push(spike(3200))
  obs.push({ kind: 'SPIKE' as const, worldX: 3350, y: 0, w: 36, h: 50 })

  obs.push(laser(3500))           // second laser
  obs.push(spike(3650))
  obs.push({ kind: 'SPIKE' as const, worldX: 3700, y: 0, w: 36, h: 40 })

  obs.push(saw(3800, FLOOR_Y))

  // ─── PORTAL 2: SHIP → CUBE at x=3950 ────────────────────────────
  obs.push(portal(3950, FLOOR_Y - 200, 50, 200, 'CUBE'))

  // ─── SECTION 3: Post-checkpoint CUBE (x 4200–5600) ──────────────
  obs.push(spike(4200))
  obs.push(spike(4300))
  obs.push(tallSpike(4450))
  obs.push(tallSpike(4490))
  obs.push(saw(4650, FLOOR_Y))
  obs.push(laser(4800))           // third laser — jump through
  obs.push(spike(4950))
  obs.push(spike(5000))
  obs.push(spike(5100))
  obs.push(saw(5250, FLOOR_Y))
  obs.push(platform(5400, FLOOR_Y - 100, 80))
  obs.push(spike(5450, 80, 20))

  // ─── PORTAL 3: CUBE → SHIP at x=5650 ────────────────────────────
  obs.push(portal(5650, FLOOR_Y - 200, 50, 200, 'SHIP'))

  // ─── SECTION 4: Second SHIP run (x 5850–7200) ───────────────────
  obs.push({ kind: 'SPIKE' as const, worldX: 5900, y: 0, w: 36, h: 50 })
  obs.push(laser(6100))
  obs.push(spike(6250))
  obs.push({ kind: 'SPIKE' as const, worldX: 6400, y: 0, w: 50, h: 50 })
  obs.push(laser(6600))
  obs.push(saw(6750, FLOOR_Y))
  obs.push({ kind: 'SPIKE' as const, worldX: 6900, y: 0, w: 36, h: 40 })
  obs.push(spike(7000))
  obs.push(laser(7100))

  // ─── PORTAL 4 (bonus): SHIP → CUBE before finale ─────────────────
  obs.push(portal(7250, FLOOR_Y - 200, 50, 200, 'CUBE'))

  // ─── SECTION 5: Finale CUBE (x 7400–7900) ───────────────────────
  obs.push(spike(7400))
  obs.push(spike(7450))
  obs.push(tallSpike(7550))
  obs.push(tallSpike(7590))
  obs.push(saw(7700, FLOOR_Y))
  obs.push(spike(7800))
  obs.push(spike(7850))

  return obs
}
