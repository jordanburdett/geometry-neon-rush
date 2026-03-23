import type { FormType, ObstacleKind, GamePhase, GameMode } from './constants'

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

export interface ChunkTemplate {
  id: string
  obstacles: (xOffset: number, rng: () => number) => Obstacle[]
}

export interface GameState {
  phase: GamePhase
  mode: GameMode
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
  // Current level (1-5) — Classic only
  currentLevel: number
  // Portal re-trigger guard: index of last overlapping portal (-1 = none)
  inPortalIdx: number
  // Survival / Daily: current scroll speed (may scale over time)
  scrollSpeed: number
  // Survival / Daily: elapsed run time for difficulty scaling
  runTime: number
  // Survival / Daily: how many full SURVIVAL_SCALE_INTERVAL windows have passed
  difficultyLevel: number
  // Survival / Daily: index of the next chunk to place
  nextChunkIndex: number
  // Survival / Daily: RNG function for procedural generation
  rng: () => number
  // Survival / Daily: score in metres
  metres: number
  // Best score for current mode (loaded from localStorage)
  bestScore: number
}
