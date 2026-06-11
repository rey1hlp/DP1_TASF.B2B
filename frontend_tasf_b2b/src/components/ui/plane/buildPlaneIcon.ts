import L from 'leaflet'
import { renderToStaticMarkup } from 'react-dom/server'
import { PlaneSvg } from "./PlaneSvg"
import { resolvePlaneColors, type SemaphoreRanges } from './resolvePlaneColor'

export function buildPlaneIcon(
  heading: number,
  carga: number,
  capacidad: number | undefined,
  ranges: SemaphoreRanges,
  dimmed = false,
): L.DivIcon {
  const rotation = heading - 45
  const { fill, stroke, strokeWidth } = resolvePlaneColors(carga, capacidad, ranges)
  const opacity = dimmed ? 0.4 : 1

  const html = renderToStaticMarkup(
    PlaneSvg({ fill, stroke, strokeWidth, rotation, opacity, size: 28 })
  )

  return L.divIcon({
    className: 'plane-marker',
    html,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}