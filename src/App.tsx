import { useRef } from 'react'
import { useGameEngine } from './useGameEngine'
import { CANVAS_W, CANVAS_H } from './game/constants'
import './App.css'

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useGameEngine(canvasRef)

  return (
    <div className="game-wrapper" role="application" aria-label="Geometry Neon Rush">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="game-canvas"
        aria-label="Game canvas — press Space or tap to jump"
      />
    </div>
  )
}

export default App
