import { IconDatabase, IconTrend } from "./icons.jsx"

const variants = {
  trend: IconTrend,
  redis: IconDatabase
}

export function ChartPanel({ title, description, variant = "trend", accent = "healthy", children }) {
  const Icon = variants[variant] ?? IconTrend

  return (
    <section className="card chart-card chart-card--panel">
      <header className="chart-card-header">
        <div className="chart-card-heading">
          <div className={`chart-card-icon chart-card-icon--${accent}`} aria-hidden="true">
            <Icon className="chart-card-icon-svg" />
          </div>
          <div className="chart-card-titles">
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
        </div>
      </header>
      <div className="chart-card-body">{children}</div>
    </section>
  )
}
