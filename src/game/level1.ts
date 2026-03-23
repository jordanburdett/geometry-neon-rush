import type { Obstacle } from './types'
import { CHECKPOINT_X } from './constants'
import {
  spike, tallSpike, saw, platform, checkpoint,
} from './levelHelpers'

// Classic Level 1 — CUBE only, no form gates
// Player starts at worldX=0. Level ends at x=8000.
// Difficulty ramps up: easy warm-up → rhythm section → checkpoint → harder combos → finale
export function buildLevel1(): Obstacle[] {
  const obs: Obstacle[] = []

  // ─── CHECKPOINT ─────────────────────────────────────────────────
  obs.push(checkpoint(CHECKPOINT_X))

  // ─── SECTION 1: Warm-up (x 1200–2200) ───────────────────────────
  obs.push(spike(1200))
  obs.push(spike(1500))
  obs.push(spike(1700))
  obs.push(spike(1900, 36, 40))
  obs.push(spike(2100))

  // ─── SECTION 2: First rhythm (x 2400–3200) ──────────────────────
  obs.push(spike(2400))
  obs.push(spike(2440))
  obs.push(spike(2640))
  obs.push(spike(2680))

  obs.push(saw(2900, 480))
  obs.push(saw(3050, 480))

  obs.push(platform(3150, 480 - 100, 80))
  obs.push(spike(3180, 80, 20))
  obs.push(spike(3350))
  obs.push(spike(3400))

  // ─── SECTION 3: Pre-checkpoint (x 3500–3950) ───────────────────
  obs.push(spike(3500))
  obs.push(spike(3600))
  obs.push(spike(3700))
  obs.push(saw(3800, 480))
  obs.push(spike(3900))

  // ─── SECTION 4: Post-checkpoint (x 4200–5500) ──────────────────
  obs.push(tallSpike(4200))
  obs.push(spike(4380))
  obs.push(tallSpike(4380 + 40))
  obs.push(spike(4560))
  obs.push(spike(4600))
  obs.push(spike(4640))

  obs.push(saw(4800, 480))
  obs.push(saw(4920, 480))
  obs.push(saw(5040, 480))

  obs.push(platform(5200, 480 - 120, 100))
  obs.push(saw(5250, 480 - 120 + 8))
  obs.push(spike(5400))
  obs.push(spike(5450))

  // ─── SECTION 5: Mid-game intensity (x 5600–6800) ────────────────
  obs.push(spike(5600))
  obs.push(spike(5650))
  obs.push(spike(5700))
  obs.push(spike(5750))

  obs.push(saw(5900, 480))
  obs.push(saw(6020, 480))

  obs.push(tallSpike(6200))
  obs.push(tallSpike(6240))
  obs.push(tallSpike(6280))

  obs.push(platform(6450, 480 - 80, 60))
  obs.push(spike(6460, 60, 20))
  obs.push(spike(6620))
  obs.push(spike(6660))
  obs.push(spike(6700))
  obs.push(spike(6740))

  obs.push(saw(6850, 480))

  // ─── SECTION 6: Finale (x 7000–7800) ────────────────────────────
  obs.push(spike(7000))
  obs.push(spike(7040))
  obs.push(spike(7080))
  obs.push(saw(7200, 480))
  obs.push(tallSpike(7300))
  obs.push(tallSpike(7340))
  obs.push(saw(7420, 480))
  obs.push(spike(7500))
  obs.push(spike(7540))
  obs.push(spike(7580))
  obs.push(saw(7680, 480))
  obs.push(tallSpike(7780))
  obs.push(tallSpike(7820))

  return obs
}
