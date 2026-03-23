// Classic Level 3 — CUBE → WAVE → CUBE
// Introduces: moving platforms (sinusoidal horizontal)
// Length: 8000px, checkpoint at x=4000
import type { Obstacle } from './types'
import { FLOOR_Y } from './constants'
import {
  spike, tallSpike, saw, platform, movingPlatform, portal, checkpoint,
} from './levelHelpers'

export function buildLevel3(): Obstacle[] {
  const obs: Obstacle[] = []

  obs.push(checkpoint(4000))

  // ─── SECTION 1: CUBE warm-up (x 1200–2600) ──────────────────────
  obs.push(spike(1200))
  obs.push(spike(1400))
  obs.push(saw(1600, FLOOR_Y))
  obs.push(spike(1800))
  obs.push(spike(1850))
  obs.push(platform(2000, FLOOR_Y - 90, 80))
  obs.push(spike(2020, 80, 20))
  obs.push(spike(2200))
  obs.push(spike(2400))

  // Moving platform challenge before portal
  obs.push(movingPlatform(2550, FLOOR_Y - 100, 70, 80, 1.2))
  obs.push(spike(2560, 70, 20))

  // ─── PORTAL 1: CUBE → WAVE at x=2700 ────────────────────────────
  obs.push(portal(2700, FLOOR_Y - 200, 50, 200, 'WAVE'))

  // ─── SECTION 2: WAVE gauntlet (x 2900–3900) ─────────────────────
  // WAVE form: player weaves between ceiling and floor obstacles
  // Spike pairs at mid-height — must time toggling to weave through
  obs.push(spike(2900))
  obs.push({ kind: 'SPIKE' as const, worldX: 2900, y: 0, w: 36, h: 80 })
  // Gap in middle — wave through the gap
  obs.push({ kind: 'SPIKE' as const, worldX: 3100, y: 0, w: 36, h: 120 })
  obs.push(spike(3200))
  obs.push(spike(3240))
  obs.push({ kind: 'SPIKE' as const, worldX: 3400, y: 0, w: 36, h: 80 })
  obs.push(saw(3500, FLOOR_Y))
  obs.push({ kind: 'SPIKE' as const, worldX: 3600, y: 0, w: 50, h: 100 })
  obs.push(spike(3700))
  obs.push(saw(3800, FLOOR_Y))

  // ─── PORTAL 2: WAVE → CUBE at x=3950 ────────────────────────────
  obs.push(portal(3950, FLOOR_Y - 200, 50, 200, 'CUBE'))

  // ─── SECTION 3: Post-checkpoint CUBE (x 4200–5700) ──────────────
  obs.push(tallSpike(4200))
  obs.push(spike(4350))
  obs.push(spike(4400))
  obs.push(saw(4550, FLOOR_Y))

  // Moving platforms section
  obs.push(movingPlatform(4700, FLOOR_Y - 110, 90, 100, 0.8))
  obs.push(movingPlatform(4900, FLOOR_Y - 110, 90, 120, 1.1))
  obs.push(spike(4950, 90, 20))

  obs.push(spike(5100))
  obs.push(spike(5150))
  obs.push(saw(5300, FLOOR_Y))
  obs.push(tallSpike(5450))
  obs.push(tallSpike(5490))

  // ─── PORTAL 3: CUBE → WAVE at x=5650 ────────────────────────────
  obs.push(portal(5650, FLOOR_Y - 200, 50, 200, 'WAVE'))

  // ─── SECTION 4: Second WAVE run (x 5850–7200) ───────────────────
  obs.push({ kind: 'SPIKE' as const, worldX: 5900, y: 0, w: 36, h: 100 })
  obs.push(spike(6000))
  obs.push({ kind: 'SPIKE' as const, worldX: 6150, y: 0, w: 50, h: 140 })
  obs.push(saw(6300, FLOOR_Y))
  obs.push(spike(6450))
  obs.push({ kind: 'SPIKE' as const, worldX: 6600, y: 0, w: 36, h: 80 })
  obs.push(spike(6750))
  obs.push({ kind: 'SPIKE' as const, worldX: 6900, y: 0, w: 36, h: 100 })
  obs.push(saw(7000, FLOOR_Y))
  obs.push(spike(7100))
  obs.push({ kind: 'SPIKE' as const, worldX: 7200, y: 0, w: 50, h: 120 })

  // ─── PORTAL 4: WAVE → CUBE for finale ────────────────────────────
  obs.push(portal(7300, FLOOR_Y - 200, 50, 200, 'CUBE'))

  // ─── SECTION 5: Finale CUBE (x 7450–7900) ───────────────────────
  obs.push(spike(7450))
  obs.push(spike(7500))
  obs.push(saw(7600, FLOOR_Y))
  obs.push(tallSpike(7700))
  obs.push(tallSpike(7740))
  obs.push(spike(7850))
  obs.push(platform(7900, FLOOR_Y - 80, 60))

  return obs
}
