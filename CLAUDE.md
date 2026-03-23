# Geometry Neon Rush — CLAUDE.md

## Build Commands

```bash
npm run dev       # Vite dev server (HMR)
npm run build     # TypeScript check + Vite production build
npm test          # Vitest unit tests (single run)
npm run test:watch # Vitest watch mode
npm run lint      # ESLint
```

## Architecture

### Canvas Rendering
- Internal resolution: **960 x 540** (16:9)
- CSS scaling: `object-fit: contain` on canvas, centered in a full-viewport flex wrapper
- **NO React state updates inside the game loop** — everything lives in `useRef` to avoid re-renders

### Game Loop (rAF)
- Lives in `useGameEngine.ts` hook
- dt capped at 50ms (0.05s) to prevent spiral-of-death on tab focus restore
- Loop: `update(dt)` → `render()` → schedule next frame
- Cleanup: `cancelAnimationFrame` on unmount

### Physics Constants (constants.ts)
- GRAVITY: 2000 px/s²
- JUMP_VY: -700 px/s (negative = up in canvas coords)
- SCROLL_SPEED: 300 px/s
- CANVAS_W: 960, CANVAS_H: 540
- FLOOR_Y: 480 (60px HUD strip at bottom)

### Canvas Coordinate System
- Origin top-left
- Y increases downward
- Floor is at y=480 (entity bottom edge)
- Player draws as 40x40 cube, starting x=100 (screen), world x tracks separately

### Level Design
- Level length: 8000 units (world x)
- Player screen x is fixed at 100px; world camera scrolls
- `cameraX` = player world x - 100
- Obstacles placed by world x coordinate
- Checkpoint at x≈4000

### Entity Types (no enum keyword — TypeScript erasableSyntaxOnly)
```ts
export const FormType = { CUBE: 'CUBE', SHIP: 'SHIP', WAVE: 'WAVE', BALL: 'BALL' } as const
export type FormType = typeof FormType[keyof typeof FormType]
```

### Collision Detection
- AABB with 80% mercy shrink (10% inset each side on x, 10% inset top)
- Hitbox: `px + pw*0.1, py + ph*0.1, pw*0.8, ph*0.8`

### File Structure
```
src/
  game/
    constants.ts    — physics constants, FormType, ObstacleKind
    types.ts        — Player, Obstacle, Particle, Star, GameState interfaces
    level1.ts       — Handcrafted level 1 obstacle layout
    physics.ts      — updateCube, aabbCollision, checkObstacleCollisions
    renderer.ts     — All canvas draw functions
    __tests__/
      collision.test.ts
  App.tsx           — Thin React shell, mounts canvas
  useGameEngine.ts  — rAF loop, game state, event handlers
  main.tsx          — React entry point
```

## Vitest Setup
- Config: `vitest.config.ts` at project root
- Environment: jsdom
- Test files: `src/**/__tests__/**/*.test.ts`

## CSS/Styling
- `index.css` is minimal: reset body/html, game wrapper styles
- No UI framework — pure CSS
- Dark background: `#0a0a1a`

## Deployment
- `base: './'` in vite.config.ts for portal iframe embedding (CRITICAL)
- Output to `dist/` for portal deployment via `scripts/add-game.sh`

## TypeScript Gotchas
- TypeScript 5.9 with `erasableSyntaxOnly: true` — no `enum` keyword allowed
- `noUnusedLocals` and `noUnusedParameters` are enabled — keep code clean
- `verbatimModuleSyntax` — use `import type` for type-only imports

## Animation Timing
- Starfield: 3 depth layers at 20/50/100 px/s
- Floor grid pulse: Math.sin(t * 2 * Math.PI * 2.33) at 140 BPM
- Trail: 15-position ring buffer, decreasing alpha

## Known Patterns
- Game state is managed via `useRef<GameState>` to avoid React re-renders mid-frame
- Screen shake: `shakeTimer > 0` → random ±offset on canvas translate each frame
- Death sequence: spawn 16 particles → 200ms shake → respawn at checkpoint
