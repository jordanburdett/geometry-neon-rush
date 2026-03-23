// Classic Level 5 — ALL FOUR FORMS. Boss-gauntlet density.
// CUBE → SHIP → WAVE → BALL → CUBE → SHIP → finale
// Length: 8000px, checkpoint at x=4000
import type { Obstacle } from './types'
import { FLOOR_Y } from './constants'
import {
  spike, tallSpike, saw, laser, movingPlatform, portal, checkpoint, platform,
} from './levelHelpers'

export function buildLevel5(): Obstacle[] {
  const obs: Obstacle[] = []

  obs.push(checkpoint(4000))

  // ─── SECTION 1: CUBE opener (x 1200–2000) ───────────────────────
  obs.push(spike(1200))
  obs.push(spike(1280))
  obs.push(tallSpike(1380))
  obs.push(saw(1500, FLOOR_Y))
  obs.push(spike(1650))
  obs.push(spike(1700))
  obs.push(spike(1800))
  obs.push(saw(1900, FLOOR_Y))

  // ─── PORTAL 1: CUBE → SHIP at x=2050 ────────────────────────────
  obs.push(portal(2050, FLOOR_Y - 200, 50, 200, 'SHIP'))

  // ─── SECTION 2: SHIP (x 2200–2900) ─────────────────────────────
  obs.push({ kind: 'SPIKE' as const, worldX: 2200, y: 0, w: 36, h: 70 })
  obs.push(spike(2350))
  obs.push(laser(2500))
  obs.push({ kind: 'SPIKE' as const, worldX: 2650, y: 0, w: 50, h: 80 })
  obs.push(spike(2800))
  obs.push(laser(2900))

  // ─── PORTAL 2: SHIP → WAVE at x=3000 ────────────────────────────
  obs.push(portal(3000, FLOOR_Y - 200, 50, 200, 'WAVE'))

  // ─── SECTION 3: WAVE (x 3150–3700) ─────────────────────────────
  obs.push(spike(3150))
  obs.push({ kind: 'SPIKE' as const, worldX: 3150, y: 0, w: 36, h: 100 })
  obs.push({ kind: 'SPIKE' as const, worldX: 3300, y: 0, w: 50, h: 130 })
  obs.push(saw(3400, FLOOR_Y))
  obs.push(spike(3550))
  obs.push({ kind: 'SPIKE' as const, worldX: 3650, y: 0, w: 36, h: 90 })

  // ─── PORTAL 3: WAVE → BALL at x=3800 ────────────────────────────
  obs.push(portal(3800, FLOOR_Y - 200, 50, 200, 'BALL'))

  // ─── SECTION 4: BALL (x 3950–5000) — straddles checkpoint ───────
  obs.push(spike(3980))
  obs.push({ kind: 'SPIKE' as const, worldX: 3980, y: 0, w: 36, h: 60 })
  // (checkpoint at 4000)
  obs.push({ kind: 'SPIKE' as const, worldX: 4200, y: 0, w: 50, h: 70 })
  obs.push(spike(4350))
  obs.push(saw(4500, FLOOR_Y))
  obs.push(spike(4650))
  obs.push({ kind: 'SPIKE' as const, worldX: 4800, y: 0, w: 36, h: 80 })
  obs.push(spike(4950))

  // ─── PORTAL 4: BALL → CUBE at x=5100 ────────────────────────────
  obs.push(portal(5100, FLOOR_Y - 200, 50, 200, 'CUBE'))

  // ─── SECTION 5: CUBE sprint (x 5250–5800) ───────────────────────
  obs.push(spike(5250))
  obs.push(spike(5300))
  obs.push(tallSpike(5400))
  obs.push(tallSpike(5440))
  obs.push(saw(5550, FLOOR_Y))

  // Moving platform challenge
  obs.push(movingPlatform(5700, FLOOR_Y - 110, 80, 100, 1.3))
  obs.push(spike(5720, 80, 20))

  // ─── PORTAL 5: CUBE → SHIP at x=5900 ────────────────────────────
  obs.push(portal(5900, FLOOR_Y - 200, 50, 200, 'SHIP'))

  // ─── SECTION 6: SHIP finale gauntlet (x 6050–7400) ──────────────
  obs.push({ kind: 'SPIKE' as const, worldX: 6100, y: 0, w: 36, h: 80 })
  obs.push(spike(6200))
  obs.push(laser(6350))
  obs.push({ kind: 'SPIKE' as const, worldX: 6500, y: 0, w: 50, h: 90 })
  obs.push(spike(6650))
  obs.push(laser(6800))
  obs.push({ kind: 'SPIKE' as const, worldX: 6950, y: 0, w: 36, h: 70 })
  obs.push(spike(7100))
  obs.push(laser(7250))
  obs.push({ kind: 'SPIKE' as const, worldX: 7400, y: 0, w: 50, h: 100 })

  // ─── PORTAL 6: SHIP → WAVE for final sprint ──────────────────────
  obs.push(portal(7500, FLOOR_Y - 200, 50, 200, 'WAVE'))

  // ─── SECTION 7: WAVE finale (x 7650–7950) ───────────────────────
  obs.push(spike(7650))
  obs.push({ kind: 'SPIKE' as const, worldX: 7650, y: 0, w: 36, h: 100 })
  obs.push(spike(7780))
  obs.push({ kind: 'SPIKE' as const, worldX: 7780, y: 0, w: 50, h: 120 })
  obs.push(platform(7900, FLOOR_Y - 80, 60))
  obs.push(spike(7920))

  return obs
}
