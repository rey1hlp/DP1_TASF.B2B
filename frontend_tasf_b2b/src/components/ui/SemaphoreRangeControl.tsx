export type SemaphoreRanges = {
  greenMax: number
  amberMax: number
}

export type SemaphoreRangeControlProps = {
  label?: string
  ranges: SemaphoreRanges
  onChange: (ranges: SemaphoreRanges) => void
}

export default function SemaphoreRangeControl({
  label = 'Rangos de semáforo',
  ranges,
  onChange,
}: SemaphoreRangeControlProps) {
  const greenMax = ranges.greenMax
  const amberMax = ranges.amberMax

  const handleGreenChange = (value: number) => {
    const next = Math.min(value, amberMax - 1)
    onChange({ greenMax: Math.max(0, next), amberMax })
  }

  const handleAmberChange = (value: number) => {
    const next = Math.max(value, greenMax + 1)
    onChange({ greenMax, amberMax: Math.min(100, next) })
  }

  return (
    <div className="field">
      <div className="field-label">{label}</div>

      <div className="range-summary-bar">
        <div
          className="range-summary-segment range-summary-green"
          style={{ width: `${greenMax}%` }}
        />
        <div
          className="range-summary-segment range-summary-amber"
          style={{ width: `${amberMax - greenMax}%` }}
        />
        <div
          className="range-summary-segment range-summary-red"
          style={{ width: `${100 - amberMax}%` }}
        />
      </div>
      <div className="range-summary-scale">
        <span>0%</span>
        <span>100%</span>
      </div>

      <div className="range-row">
        <span className="range-dot range-dot-green" />
        <input
          className="range-input range-input-green"
          type="range"
          min={0}
          max={100}
          value={greenMax}
          onChange={(event) => handleGreenChange(Number(event.target.value))}
        />
        <span className="range-value">{`0% - ${greenMax}%`}</span>
      </div>
      <div className="range-row">
        <span className="range-dot range-dot-amber" />
        <input
          className="range-input range-input-amber"
          type="range"
          min={0}
          max={100}
          value={amberMax}
          onChange={(event) => handleAmberChange(Number(event.target.value))}
        />
        <span className="range-value">{`${greenMax + 1}% - ${amberMax}%`}</span>
      </div>
      <div className="range-row">
        <span className="range-dot range-dot-red" />
        <div className="range-static">{`${amberMax + 1}% - 100%`}</div>
      </div>
    </div>
  )
}
