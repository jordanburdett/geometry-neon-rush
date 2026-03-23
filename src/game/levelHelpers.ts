// Shared level building helpers
import type { Obstacle } from './types'
import type { FormType } from './constants'
import { ObstacleKind, FLOOR_Y } from './constants'

// Helper: spike sitting on the floor
export function spike(worldX: number, w = 36, h = 40): Obstacle {
  return { kind: ObstacleKind.SPIKE, worldX, y: FLOOR_Y - h, w, h }
}

// Helper: tall spike
export function tallSpike(worldX: number, w = 30, h = 60): Obstacle {
  return { kind: ObstacleKind.SPIKE, worldX, y: FLOOR_Y - h, w, h }
}

// Helper: ceiling spike (hangs from ceiling)
export function ceilSpike(worldX: number, w = 36, h = 40): Obstacle {
  return { kind: ObstacleKind.SPIKE, worldX, y: 0, w, h }
}

// Helper: spike at arbitrary y
export function spikeAt(worldX: number, y: number, w = 36, h = 40): Obstacle {
  return { kind: ObstacleKind.SPIKE, worldX, y, w, h }
}

// Helper: saw blade
export function saw(worldX: number, y: number, r = 24): Obstacle {
  return { kind: ObstacleKind.SAW, worldX, y: y - r, w: r * 2, h: r * 2, angle: 0 }
}

// Helper: platform
export function platform(worldX: number, y: number, w: number, h = 18): Obstacle {
  return { kind: ObstacleKind.PLATFORM, worldX, y, w, h }
}

// Helper: moving platform (sinusoidal horizontal)
export function movingPlatform(
  baseX: number,
  y: number,
  w: number,
  amplitude: number,
  freq: number,
  h = 18,
): Obstacle {
  return {
    kind: ObstacleKind.PLATFORM,
    worldX: baseX,
    y,
    w,
    h,
    moving: { amplitude, freq, baseX },
  }
}

// Helper: laser wall (thin full-height vertical red line)
export function laser(worldX: number): Obstacle {
  return {
    kind: ObstacleKind.LASER,
    worldX,
    y: 0,
    w: 8,
    h: FLOOR_Y,
    laserOn: true,
    laserTimer: 0,
  }
}

// Helper: form-gate portal
export function portal(
  worldX: number,
  y: number,
  w: number,
  h: number,
  targetForm: FormType,
): Obstacle {
  return { kind: ObstacleKind.PORTAL, worldX, y, w, h, targetForm }
}

// Helper: checkpoint flag
export function checkpoint(worldX: number): Obstacle {
  return {
    kind: ObstacleKind.SPIKE, // reuse SPIKE shape; isCheckpoint overrides rendering
    worldX,
    y: FLOOR_Y - 80,
    w: 8,
    h: 80,
    isCheckpoint: true,
    reached: false,
  }
}
