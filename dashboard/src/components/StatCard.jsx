export function StatCard({ label, value, tone = "default", helper, icon }) {
  return (
    <article className={`card stat-card tone-${tone}`}>
      <div className="stat-card-head">
        <span className="eyebrow">{label}</span>
        {icon ? (
          <span className="stat-card-icon-tile" aria-hidden="true">
            {icon}
          </span>
        ) : null}
      </div>
      <strong>{value}</strong>
      {helper ? <p>{helper}</p> : null}
    </article>
  )
}
