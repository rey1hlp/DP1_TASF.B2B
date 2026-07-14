import { Pause, Play } from 'lucide-react'

const SPEED_OPTIONS = [0.25, 0.5, 1, 1.5, 2] as const

type SimulationPlaybackChipProps = {
  isPaused: boolean
  isDisabled?: boolean
  speed: number
  onPause: () => void
  onResume: () => void
  onSpeedChange: (speed: number) => void
}

export default function SimulationPlaybackChip({
  isPaused,
  isDisabled,
  speed,
  onPause,
  onResume,
  onSpeedChange,
}: SimulationPlaybackChipProps) {
  return (
    <div className="simulation-playback-chip" aria-label="Controles de reproduccion de simulacion">
      <button
        type="button"
        className="playback-main-button"
        onClick={isPaused ? onResume : onPause}
        disabled={isDisabled}
      >
        {isPaused ? <Play size={18} aria-hidden="true" /> : <Pause size={18} aria-hidden="true" />}
        <span>{isPaused ? 'Reanudar' : 'Pausar'}</span>
      </button>

      <div className="playback-speed-group" role="group" aria-label="Velocidad de simulacion">
        {SPEED_OPTIONS.map((option) => (
          <button
            type="button"
            key={option}
            className={`playback-speed-button ${speed === option ? 'active' : ''}`}
            onClick={() => onSpeedChange(option)}
            disabled={isDisabled}
            aria-pressed={speed === option}
          >
            {option}x
          </button>
        ))}
      </div>
    </div>
  )
}
