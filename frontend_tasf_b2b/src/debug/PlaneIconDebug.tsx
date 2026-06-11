import { useState } from 'react'
import { PlaneSvg } from "../components/ui/plane/PlaneSvg"
import { resolvePlaneColors } from "../components/ui/plane/resolvePlaneColors"

const RANGES = { greenMax: 33, amberMax: 66 }
const SIZE = 48

const CASES: { label: string; carga: number; capacidad: number | undefined; dimmed?: boolean }[] = [
  { label: 'Sin datos',      carga: 0,   capacidad: undefined },
  { label: 'Cap. cero',      carga: 0,   capacidad: 0         },
  { label: 'Vacío',          carga: 0,   capacidad: 100       },
  { label: 'Poco lleno 20%', carga: 20,  capacidad: 100       },
  { label: 'Medio 50%',      carga: 50,  capacidad: 100       },
  { label: 'Casi lleno 80%', carga: 80,  capacidad: 100       },
  { label: 'Lleno 100%',     carga: 100, capacidad: 100       },
  { label: 'Dimmed 50%',     carga: 50,  capacidad: 100, dimmed: true },
]

export function PlaneIconDebug() {
  const [rotation, setRotation] = useState(0)

  return (
    <div style={{ padding: 32, fontFamily: 'monospace', background: '#1a1a2e', minHeight: '100vh' }}>
      <h2 style={{ color: '#fff', marginBottom: 8 }}>Plane icon debug</h2>

      <label style={{ color: '#aaa', fontSize: 13 }}>
        Rotación: {rotation}°
        <input
          type="range"
          min={0}
          max={359}
          value={rotation}
          onChange={(e) => setRotation(Number(e.target.value))}
          style={{ marginLeft: 12, width: 200, verticalAlign: 'middle' }}
        />
      </label>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginTop: 32 }}>
        {CASES.map(({ label, carga, capacidad, dimmed }) => {
          const { fill, stroke, strokeWidth } = resolvePlaneColors(carga, capacidad, RANGES)
          const percent =
            capacidad !== undefined && capacidad > 0
              ? ((carga / capacidad) * 100).toFixed(0) + '%'
              : 'n/d'

          return (
            <div
              key={label}
              style={{
                background: '#2a2a3e',
                borderRadius: 8,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                minWidth: 120,
              }}
            >
              <PlaneSvg
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
                rotation={rotation}
                opacity={dimmed ? 0.4 : 1}
                size={SIZE}
              />
              <span style={{ color: '#fff', fontSize: 12, textAlign: 'center' }}>{label}</span>
              <span style={{ color: '#888', fontSize: 11 }}>
                {carga} / {capacidad ?? '—'} ({percent})
              </span>
              <span style={{ color: '#666', fontSize: 10 }}>
                fill: {fill}<br />stroke: {stroke}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}