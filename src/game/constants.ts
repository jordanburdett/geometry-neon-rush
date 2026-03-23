// Game dimensions
export const CANVAS_W = 960
export const CANVAS_H = 540
export const FLOOR_Y = 480 // bottom of play area, 60px HUD below

// Physics
export const GRAVITY = 2000 // px/s²
export const JUMP_VY = -700 // px/s (negative = up)
export const SCROLL_SPEED = 300 // px/s
export const PLAYER_SIZE = 40 // px (cube side length)
export const PLAYER_SCREEN_X = 100 // fixed screen x position

// DUAL mode: each lane occupies a 270px-tall horizontal strip
export const DUAL_STRIP_H = 270   // height of each strip in dual mode
export const DUAL_FLOOR_Y = DUAL_STRIP_H - PLAYER_SIZE   // derived: 270 - 40 = 230

// Level
export const LEVEL_LENGTH = 8000 // world x units
export const CHECKPOINT_X = 4000 // world x of checkpoint flag

// Screen shake
export const SHAKE_DURATION = 0.2 // seconds
export const SHAKE_MAGNITUDE = 8 // px

// Death particles
export const PARTICLE_COUNT = 16
export const PARTICLE_LIFETIME = 0.6 // seconds

// Trail
export const TRAIL_LENGTH = 15

// Starfield layers: [speed px/s, count]
export const STAR_LAYERS: [number, number][] = [
  [20, 25],
  [50, 20],
  [100, 20],
]

// Floor grid
export const GRID_LINE_SPACING = 60 // px between horizontal lines
export const PULSE_BPM = 140
export const PULSE_HZ = PULSE_BPM / 60 // 2.333... Hz

// FormType — const object pattern (no enum, erasableSyntaxOnly)
export const FormType = {
  CUBE: 'CUBE',
  SHIP: 'SHIP',
  WAVE: 'WAVE',
  BALL: 'BALL',
} as const
export type FormType = (typeof FormType)[keyof typeof FormType]

// Form physics constants
export const SHIP_THRUST = 1400 // px/s² upward acceleration
export const SHIP_VY_MAX = 600  // px/s clamp magnitude
export const WAVE_SPEED = 300   // px/s constant vertical speed

// Form accent colors (for trail + portals)
export const FORM_COLOR: Record<FormType, string> = {
  CUBE: '#00ffff',
  SHIP: '#ff2d78',
  WAVE: '#ffd700',
  BALL: '#39ff14',
}

// ObstacleKind
export const ObstacleKind = {
  SPIKE: 'SPIKE',
  SAW: 'SAW',
  LASER: 'LASER',
  PLATFORM: 'PLATFORM',
  PORTAL: 'PORTAL',
} as const
export type ObstacleKind = (typeof ObstacleKind)[keyof typeof ObstacleKind]

// Game phase
export const GamePhase = {
  START: 'START',
  PLAYING: 'PLAYING',
  DEAD: 'DEAD',
  COMPLETE: 'COMPLETE',
  LEVEL_COMPLETE: 'LEVEL_COMPLETE',
} as const
export type GamePhase = (typeof GamePhase)[keyof typeof GamePhase]

// Game mode
export const GameMode = {
  CLASSIC: 'CLASSIC',
  SURVIVAL: 'SURVIVAL',
  DAILY: 'DAILY',
  DUAL: 'DUAL',
} as const
export type GameMode = (typeof GameMode)[keyof typeof GameMode]

// Survival difficulty scaling
export const SURVIVAL_SCALE_INTERVAL = 15 // seconds between speed increases
export const SURVIVAL_SCALE_FACTOR = 0.05 // 5% speed increase per interval
export const CHUNK_WIDTH = 960 // px width of each procedural chunk
