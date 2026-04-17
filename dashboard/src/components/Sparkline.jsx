import { useId } from "react"

function defaultFormat(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—"
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

export function Sparkline({ points, valueKey, tone = "default", formatValue = defaultFormat, unit = "" }) {
  const uid = useId().replace(/:/g, "")

  if (!points.length) {
    return <div className="sparkline empty">No data</div>
  }

  const values = points.map((point) => point[valueKey] ?? 0)
  const max = Math.max(1, ...values)
  const min = Math.min(...values)
  const last = values[values.length - 1]

  const W = 336
  const H = 108
  const padL = 40
  const padR = 10
  const padY = 14
  const plotW = W - padL - padR
  const plotH = H - padY * 2
  const step = values.length === 1 ? plotW : plotW / (values.length - 1)

  const normY = (value) => {
    const n = max === min ? 0.5 : (value - min) / (max - min)
    return H - padY - n * plotH
  }

  const xAt = (i) => padL + i * step

  const pathD = values
    .map((value, index) => {
      const x = xAt(index)
      const y = normY(value)
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(" ")

  let areaD = `M ${padL} ${H - padY}`
  values.forEach((value, index) => {
    areaD += ` L ${xAt(index).toFixed(2)} ${normY(value).toFixed(2)}`
  })
  areaD += ` L ${xAt(values.length - 1).toFixed(2)} ${H - padY} Z`

  const hGrids = [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => {
    const y = padY + (1 - t) * plotH
    return <line key={`h-${t}`} x1={padL} y1={y} x2={W - padR} y2={y} className="sparkline-grid" />
  })

  const vGrids = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const x = padL + t * plotW
    return <line key={`v-${t}`} x1={x} y1={padY} x2={x} y2={H - padY} className="sparkline-grid sparkline-grid--vert" />
  })

  const gradDefault = `sparkStrokeDefault-${uid}`
  const gradHealthy = `sparkStrokeHealthy-${uid}`
  const gradWarn = `sparkStrokeWarn-${uid}`
  const gradArea = `sparkAreaFill-${uid}`

  const strokeMap = {
    default: gradDefault,
    healthy: gradHealthy,
    warn: gradWarn
  }
  const strokeGrad = strokeMap[tone] ?? gradDefault

  const yMax = formatValue(max)
  const yMin = formatValue(min)
  const same = max === min || yMax === yMin

  return (
    <div className="sparkline-frame">
      <svg className={`sparkline tone-${tone}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={gradDefault} x1="0" y1="0" x2="320" y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6eb8f0" />
            <stop offset="1" stopColor="#a8d4ff" />
          </linearGradient>
          <linearGradient id={gradHealthy} x1="0" y1="0" x2="320" y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2ee6a6" />
            <stop offset="1" stopColor="#7dffb3" />
          </linearGradient>
          <linearGradient id={gradWarn} x1="0" y1="0" x2="320" y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="#e8a82e" />
            <stop offset="1" stopColor="#ffd27a" />
          </linearGradient>
          <linearGradient id={gradArea} x1="168" y1="0" x2="168" y2={H} gradientUnits="userSpaceOnUse">
            <stop stopColor="currentColor" stopOpacity="0.2" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g className="sparkline-grid-group">
          {vGrids}
          {hGrids}
        </g>
        {!same ? (
          <>
            <text x={padL - 6} y={normY(max)} textAnchor="end" dominantBaseline="middle" className="sparkline-y-label">
              {yMax}
            </text>
            <text x={padL - 6} y={normY(min)} textAnchor="end" dominantBaseline="middle" className="sparkline-y-label">
              {yMin}
            </text>
          </>
        ) : (
          <text x={padL - 6} y={normY(max)} textAnchor="end" dominantBaseline="middle" className="sparkline-y-label">
            {yMax}
          </text>
        )}
        <path d={areaD} fill={`url(#${gradArea})`} className={`sparkline-area tone-${tone}`} />
        <path d={pathD} fill="none" stroke={`url(#${strokeGrad})`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="sparkline-legend" aria-label="Series range">
        <div className="sparkline-legend-cell">
          <span className="sparkline-legend-k">Low</span>
          <span className="sparkline-legend-v">
            {formatValue(min)}
            {unit}
          </span>
        </div>
        <div className="sparkline-legend-cell">
          <span className="sparkline-legend-k">High</span>
          <span className="sparkline-legend-v">
            {formatValue(max)}
            {unit}
          </span>
        </div>
        <div className="sparkline-legend-cell">
          <span className="sparkline-legend-k">Latest</span>
          <span className="sparkline-legend-v">
            {formatValue(last)}
            {unit}
          </span>
        </div>
      </div>
    </div>
  )
}
