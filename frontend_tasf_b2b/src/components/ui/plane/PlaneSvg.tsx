export const PLANE_PATH =
  "M 17.8 19.2 L 16 11 l 3.5 -3.5 C 21 6 21.5 4 21 3 c -1 -0.5 -3 0 -4.5 1.5 L 13 8 L 4.8 6.2 c -0.5 -0.1 -0.9 0.1 -1.1 0.5 l -0.3 0.5 c -0.2 0.5 -0.1 1 0.3 1.3 L 9 12 l -2 3 H 4 l -1 1 l 3 2 l 2 3 l 1 -1 v -3 l 3 -2 l 3.5 5.3 c 0.3 0.4 0.8 0.5 1.3 0.3 l 0.5 -0.2 c 0.4 -0.3 0.6 -0.7 0.5 -1.2 Z"

export type PlaneSvgProps = {
  fill: string
  stroke: string
  strokeWidth: number
  rotation: number
  opacity?: number
  size?: number
}

export function PlaneSvg({
  fill,
  stroke,
  strokeWidth,
  rotation,
  opacity = 1,
  size = 28,
}: PlaneSvgProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        opacity,
        transform: `rotate(${rotation}deg)`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={PLANE_PATH} />
      </svg>
    </div>
  )
}