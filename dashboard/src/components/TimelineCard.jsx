import { PanelHead } from "./PanelHead.jsx"

function EmptyShieldIcon() {
  return (
    <svg className="timeline-empty-icon-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M24 5 40 11v14c0 10.2-6.8 19.7-16 22.5L24 43l-.3.1C14.5 40.3 8 30.8 8 25V11L24 5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="rgba(61,156,240,0.08)"
      />
      <path d="M17 24.5 22 29.5 33 18.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function TimelineCard({ title, subtitle, items, format, emptyMessage = "No events yet", icon, iconAccent = "default" }) {
  return (
    <section className="card timeline-card">
      <PanelHead title={title} subtitle={subtitle} icon={icon} accent={iconAccent} />
      <div className={`timeline-list ${items.length === 0 ? "timeline-list--empty" : ""}`}>
        {items.length === 0 ? (
          <div className="timeline-empty" role="status">
            <div className="timeline-empty-icon">
              <EmptyShieldIcon />
            </div>
            <p className="timeline-empty-title">No events in this window</p>
            <p className="timeline-empty-desc">{emptyMessage}</p>
          </div>
        ) : null}
        {items.map((item, index) => (
          <article key={`${title}-${item.bucket}-${index}`} className="timeline-item">
            {format(item)}
          </article>
        ))}
      </div>
    </section>
  )
}
