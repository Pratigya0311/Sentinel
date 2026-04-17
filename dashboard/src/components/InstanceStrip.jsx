import { PanelHead } from "./PanelHead.jsx"
import { IconServer } from "./icons.jsx"

export function InstanceStrip({ instances }) {
  if (!instances?.length) {
    return (
      <section className="card instance-card">
        <PanelHead
          title="Gateway instances"
          subtitle="Per-instance throughput appears once gateways emit ticks."
          accent="default"
          icon={<IconServer className="panel-head-icon-svg" />}
        />
        <p className="instance-empty">No gateway instances in the latest snapshot. Start the stack or run a demo script to populate telemetry.</p>
      </section>
    )
  }

  return (
    <section className="card instance-card">
      <PanelHead
        title="Gateway instances"
        subtitle="Live request mix per gateway process."
        accent="default"
        icon={<IconServer className="panel-head-icon-svg" />}
      />
      <div className="instance-list">
        {instances.map((instance) => (
          <article key={instance.instanceId} className="instance-pill">
            <strong>{instance.instanceId}</strong>
            <span>{instance.totalRequests} requests</span>
            <span>{instance.allowedCount} allowed</span>
            <span>{instance.blockedCount} blocked</span>
          </article>
        ))}
      </div>
    </section>
  )
}
