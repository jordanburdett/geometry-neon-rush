import type { FormType, ObstacleKind, GamePhase } from './constants'

export interface Player {
  // World position (x is world coordinate)
  worldX: number
  y: number
  vy: number
  onGround: boolean
  form: FormType
  rotation: number // radians, for cube spin
  // BALL form: gravity sign (+1 normal, -1 inverted)
  gravSign: number
  // WAVE form: current direction
  waveDir: 'UP' | 'DOWN'
  // Trail positions (screen x, y)
  trail: Array<{ x: number; y: number }>
}

export interface Obstacle {
  kind: ObstacleKind
  worldX: number
  y: number
  w: number
  h: number
  // For saws: rotation angle
  angle?: number
  // For checkpoints
  isCheckpoint?: boolean
  reached?: boolean
  // For portals: which form to switch to
  targetForm?: FormType
  // For moving platforms/obstacles: sinusoidal horizontal motion
  moving?: { amplitude: number; freq: number; baseX: number }
  // For laser flicker tracking
  laserOn?: boolean
  laserTimer?: number
}

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number // remaining lifetime in seconds
  maxLife: number
  color: string
  size: number
}

export interface Star {
  x: number // screen x (wraps)
  y: number // screen y
  speed: number // px/s
  size: number
  brightness: number
}

export interface GameState {
  phase: GamePhase
  player: Player
  obstacles: Obstacle[]
  particles: Particle[]
  stars: Star[]
  // Camera
  cameraX: number
  // Checkpoint
  checkpointReached: boolean
  checkpointWorldX: number
  // Shake
  shakeTimer: number
  shakeX: number
  shakeY: number
  // Time accumulator (for pulsing effects)
  time: number
  // Respawn cooldown after death
  respawnTimer: number
  // Attempt count
  attempts: number
  // Current level (1-5)
  currentLevel: number
  // Portal re-trigger guard: index of last overlapping portal (-1 = none)
  inPortalIdx: number
}
