// Classic Level 4 — SHIP → WAVE → BALL → SHIP
// More complex switching, all three non-CUBE forms
// Length: 8000px, checkpoint at x=4000
import type { Obstacle } from './types'
import { FLOOR_Y } from './constants'
import {
  spike, saw, laser, movingPlatform, portal, checkpoint,
} from './levelHelpers'

export function buildLevel4(): Obstacle[] {
  const obs: Obstacle[] = []

  obs.push(checkpoint(4000))

  // ─── SECTION 1: SHIP opener (x 1000–2500) ───────────────────────
  // Player starts as CUBE; first portal immediately converts
  obs.push(portal(1100, FLOOR_Y - 200, 50, 200, 'SHIP'))

  obs.push({ kind: 'SPIKE' as const, worldX: 1300, y: 0, w: 36, h: 60 })
  obs.push(spike(1450))
  obs.push({ kind: 'SPIKE' as const, worldX: 1600, y: 0, w: 36, h: 80 })
  obs.push(laser(1750))
  obs.push(spike(1900))
  obs.push({ kind: 'SPIKE' as const, worldX: 2050, y: 0, w: 50, h: 60 })
  obs.push(laser(2200))
  obs.push(spike(2350))

  // ─── PORTAL 2: SHIP → WAVE at x=2500 ────────────────────────────
  obs.push(portal(2500, FLOOR_Y - 200, 50, 200, 'WAVE'))

  // ─── SECTION 2: WAVE section (x 2700–3400) ──────────────────────
  obs.push({ kind: 'SPIKE' as const, worldX: 2750, y: 0, w: 36, h: 100 })
  obs.push(spike(2850))
  obs.push({ kind: 'SPIKE' as const, worldX: 3000, y: 0, w: 50, h: 130 })
  obs.push(saw(3100, FLOOR_Y))
  obs.push(spike(3200))
  obs.push({ kind: 'SPIKE' as const, worldX: 3300, y: 0, w: 36, h: 80 })

  // ─── PORTAL 3: WAVE → BALL at x=3500 ────────────────────────────
  obs.push(portal(3500, FLOOR_Y - 200, 50, 200, 'BALL'))

  // ─── SECTION 3: BALL section (x 3700–5200) ──────────────────────
  // BALL flips gravity — need obstacles on both floor AND ceiling
  obs.push(spike(3750))
  obs.push({ kind: 'SPIKE' as const, worldX: 3750, y: 0, w: 36, h: 50 })
  obs.push(spike(3950))
  obs.push(saw(4100, FLOOR_Y))
  // Post-checkpoint
  obs.push({ kind: 'SPIKE' as const, worldX: 4300, y: 0, w: 36, h: 60 })
  obs.push(spike(4400))
  obs.push({ kind: 'SPIKE' as const, worldX: 4550, y: 0, w: 50, h: 70 })
  obs.push(spike(4700))
  obs.push(saw(4850, FLOOR_Y))
  obs.push({ kind: 'SPIKE' as const, worldX: 5000, y: 0, w: 36, h: 80 })
  obs.push(spike(5100))

  // ─── PORTAL 4: BALL → SHIP at x=5300 ────────────────────────────
  obs.push(portal(5300, FLOOR_Y - 200, 50, 200, 'SHIP'))

  // ─── SECTION 4: Final SHIP run (x 5500–7400) ────────────────────
  obs.push({ kind: 'SPIKE' as const, worldX: 5550, y: 0, w: 36, h: 70 })
  obs.push(spike(5700))
  obs.push(laser(5900))
  obs.push({ kind: 'SPIKE' as const, worldX: 6100, y: 0, w: 36, h: 80 })
  obs.push(spike(6250))
  obs.push(laser(6400))
  obs.push(movingPlatform(6550, FLOOR_Y - 100, 80, 80, 1.0))
  obs.push({ kind: 'SPIKE' as const, worldX: 6700, y: 0, w: 50, h: 70 })
  obs.push(laser(6850))
  obs.push(spike(7000))
  obs.push({ kind: 'SPIKE' as const, worldX: 7150, y: 0, w: 36, h: 60 })
  obs.push(laser(7300))

  // ─── PORTAL 5: SHIP → WAVE for finale sprint ─────────────────────
  obs.push(portal(7450, FLOOR_Y - 200, 50, 200, 'WAVE'))

  // ─── SECTION 5: Finale WAVE sprint (x 7600–7900) ────────────────
  obs.push({ kind: 'SPIKE' as const, worldX: 7600, y: 0, w: 36, h: 80 })
  obs.push(spike(7700))
  obs.push({ kind: 'SPIKE' as const, worldX: 7800, y: 0, w: 50, h: 100 })
  obs.push(spike(7900))

  return obs
}
