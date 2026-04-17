export function PanelHead({ title, subtitle, icon, accent = "default", compact = false }) {
  return (
    <header className={`panel-head ${compact ? "panel-head--compact" : ""}`.trim()}>
      {icon ? (
        <div className={`panel-head-icon panel-head-icon--${accent}`} aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <div className="panel-head-copy">
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
    </header>
  )
}
