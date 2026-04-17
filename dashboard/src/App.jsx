import { useEffect, useState } from "react"
import { StatCard } from "./components/StatCard.jsx"
import { TableCard } from "./components/TableCard.jsx"
import { InstanceStrip } from "./components/InstanceStrip.jsx"
import { Sparkline } from "./components/Sparkline.jsx"
import { TimelineCard } from "./components/TimelineCard.jsx"
import { MiniBars } from "./components/MiniBars.jsx"
import { BrandMark } from "./components/BrandMark.jsx"
import { ChartPanel } from "./components/ChartPanel.jsx"
import { PanelHead } from "./components/PanelHead.jsx"
import {
  IconActivity,
  IconBarsSplit,
  IconBlock,
  IconCheck,
  IconCoins,
  IconDatabase,
  IconDeny,
  IconGauge,
  IconHistory,
  IconRadar,
  IconRoute,
  IconServer,
  IconShield,
  IconSliders,
  IconSparkline,
  IconUsers
} from "./components/icons.jsx"
import "./styles/layout.css"
import "./styles/cards.css"
import "./styles/charts.css"
import "./styles/tables.css"

const emptySnapshot = {
  generatedAt: "",
  totals: {
    totalRequests: 0,
    allowedCount: 0,
    blockedCount: 0,
    creditsConsumed: 0,
    redis: { status: "unknown", failures: 0 },
    controller: { multiplier: 1, health: "unknown", reason: "UNINITIALIZED" },
    degraded: { active: false, modes: {} }
  },
  topTenants: [],
  topEndpoints: [],
  topReasons: [],
  history: []
}

function formatRatio(value) {
  return `${Number(value).toFixed(1)}%`
}

function formatInt(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return "0"
  return x.toLocaleString("en-US", { maximumFractionDigits: 0 })
}

function formatMultiplier(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return "1.00"
  return x.toFixed(2)
}

function formatRps(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return "0.0"
  return x.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 1 })
}

function livePillClass(connectionState) {
  if (connectionState === "connected") return "live-pill--connected"
  if (connectionState === "error") return "live-pill--error"
  if (connectionState === "connecting") return "live-pill--connecting"
  return "live-pill--streaming"
}

function livePillLabel(connectionState) {
  if (connectionState === "connected") return "Live stream"
  if (connectionState === "error") return "Disconnected"
  if (connectionState === "connecting") return "Connecting"
  return "Reconnecting"
}

function redisTone(status) {
  if (status === "healthy") return "healthy"
  if (status === "unstable") return "warn"
  return "alert"
}

function summarizeDegradedModes(modes) {
  const entries = Object.entries(modes ?? {})
  return entries.length === 0
    ? "No degraded decisions"
    : entries.map(([mode, count]) => `${mode} ×${count}`).join(", ")
}

function pillToneRedis(status) {
  if (status === "healthy") return "status-pill--ok"
  if (status === "unstable") return "status-pill--warn"
  return "status-pill--risk"
}

function pillToneDegraded(active) {
  return active ? "status-pill--risk" : "status-pill--ok"
}

function pillToneBlockRate(pctStr) {
  const n = Number.parseFloat(pctStr)
  if (!Number.isFinite(n)) return ""
  if (n >= 30) return "status-pill--risk"
  if (n >= 15) return "status-pill--warn"
  return "status-pill--ok"
}

function formatSnapshotTime(iso) {
  if (!iso || typeof iso !== "string") return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short"
  }).format(d)
}

function App() {
  const [snapshot, setSnapshot] = useState(emptySnapshot)
  const [connectionState, setConnectionState] = useState("connecting")
  const aggregatorBase = import.meta.env.VITE_AGGREGATOR_URL ?? ""

  useEffect(() => {
    let closed = false

    async function bootstrap() {
      try {
        const response = await fetch(`${aggregatorBase}/snapshot`)
        const data = await response.json()
        if (!closed) {
          setSnapshot(data)
          setConnectionState("connected")
        }
      } catch {
        if (!closed) {
          setConnectionState("error")
        }
      }
    }

    bootstrap()

    const events = new EventSource(`${aggregatorBase}/events`)
    events.addEventListener("snapshot", (event) => {
      if (!closed) {
        setSnapshot(JSON.parse(event.data))
        setConnectionState("connected")
      }
    })
    events.onerror = () => {
      if (!closed) {
        setConnectionState("streaming")
      }
    }

    return () => {
      closed = true
      events.close()
    }
  }, [aggregatorBase])

  const blockedRatio = snapshot.totals.totalRequests
    ? ((snapshot.totals.blockedCount / snapshot.totals.totalRequests) * 100).toFixed(1)
    : "0.0"
  const topTenant = snapshot.topTenants?.[0]
  const topReason = snapshot.topReasons?.[0]
  const hasDegradedEvents = (snapshot.degradedTimeline?.length ?? 0) > 0
  const budgetHealthTone =
    snapshot.totals.controller.health === "healthy"
      ? "healthy"
      : snapshot.totals.controller.health === "stressed" || snapshot.totals.controller.health === "critical"
        ? "warn"
        : "default"

  const headerTime =
    connectionState === "error"
      ? "—"
      : snapshot.generatedAt
        ? formatSnapshotTime(snapshot.generatedAt)
        : "Waiting…"

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-brand">
            <BrandMark />
            <div className="brand-text">
              <span className="brand-name">Sentinel</span>
              <span className="brand-tagline">Operations · traffic governance</span>
            </div>
          </div>
          <div className="app-header-meta">
            <span className={`live-pill ${livePillClass(connectionState)}`} role="status" aria-live="polite">
              {livePillLabel(connectionState)}
            </span>
            <span className="header-time" title={snapshot.generatedAt || "Last snapshot"}>
              Updated {headerTime}
            </span>
          </div>
        </div>
      </header>

      <main className="page">
        <h1 className="sr-only">Sentinel operations dashboard</h1>

        <section className="hero-shell" aria-labelledby="hero-heading">
          <div className="hero-copy card hero-panel">
            <div>
              <p className="hero-kicker">Traffic governance layer</p>
              <h2 id="hero-heading">Live control room</h2>
              <p className="lede">
                Globally coordinated, cost-aware API governance with explainable enforcement, live fairness visibility,
                and adaptive backend protection.
              </p>
            </div>
            <div className="hero-meta">
              <article className="hero-chip">
                <span className="eyebrow">Top tenant</span>
                <strong>{topTenant?.key ?? "—"}</strong>
                <small>{topTenant ? `${formatInt(topTenant.credits)} credits` : "No traffic yet"}</small>
              </article>
              <article className="hero-chip">
                <span className="eyebrow">Dominant reason</span>
                <strong>{topReason?.reason ?? "ALLOWED"}</strong>
                <small>{topReason ? `${formatInt(topReason.count)} decisions` : "No events yet"}</small>
              </article>
              <article className="hero-chip">
                <span className="eyebrow">Controller</span>
                <strong>{snapshot.totals.controller.health}</strong>
                <small>{snapshot.totals.controller.reason}</small>
              </article>
            </div>
          </div>
          <div className="hero-badge">
            <div className="hero-snapshot-head">
              <span className="hero-kicker">Snapshot</span>
              <strong className="hero-snapshot-time">
                {snapshot.generatedAt
                  ? formatSnapshotTime(snapshot.generatedAt)
                  : connectionState === "error"
                    ? "Aggregator unreachable"
                    : "Waiting for telemetry"}
              </strong>
            </div>
            <div className="hero-status-list">
              <div className={`status-pill ${pillToneRedis(snapshot.totals.redis.status)}`}>
                <span className="eyebrow">Redis</span>
                <strong>{snapshot.totals.redis.status}</strong>
              </div>
              <div className={`status-pill ${pillToneDegraded(snapshot.totals.degraded.active)}`}>
                <span className="eyebrow">Degraded</span>
                <strong>{snapshot.totals.degraded.active ? "Active" : "Clear"}</strong>
              </div>
              <div className={`status-pill ${pillToneBlockRate(blockedRatio)}`}>
                <span className="eyebrow">Block rate</span>
                <strong>{formatRatio(blockedRatio)}</strong>
              </div>
            </div>
          </div>
        </section>

        {snapshot.totals.totalRequests === 0 ? (
          <section className="card status-card">
            <PanelHead
              title="No traffic yet"
              subtitle="The aggregator is running, but no gateway ticks have been merged into the current window."
              accent="default"
              icon={<IconRadar className="panel-head-icon-svg" />}
            />
            <div className="status-stack">
              <div className="status-kv">
                <span className="eyebrow">Connection</span>
                <strong className="status-kv-value">{connectionState}</strong>
              </div>
              <div className="status-kv">
                <span className="eyebrow">Try</span>
                <strong className="status-kv-value status-kv-value--codes">
                  <code className="mono-inline">npm run demo:live</code>
                  <span className="status-kv-sep">·</span>
                  <code className="mono-inline">npm run demo:seed</code>
                </strong>
              </div>
              <div className="status-kv">
                <span className="eyebrow">Aggregator base</span>
                <strong className="status-kv-value">{aggregatorBase || "Same origin (/snapshot, /events)"}</strong>
              </div>
            </div>
          </section>
        ) : null}

        <section className="stats-grid" aria-label="Key metrics">
          <StatCard
            label="Requests"
            value={formatInt(snapshot.totals.totalRequests)}
            helper="Merged from gateway ticks"
            icon={<IconActivity className="stat-icon-svg" />}
          />
          <StatCard
            label="RPS"
            value={formatRps(snapshot.currentRps ?? 0)}
            helper="Current 1s throughput"
            icon={<IconGauge className="stat-icon-svg" />}
          />
          <StatCard
            label="Allowed"
            value={formatInt(snapshot.totals.allowedCount)}
            tone="healthy"
            helper="Forwarded to backend"
            icon={<IconCheck className="stat-icon-svg" />}
          />
          <StatCard
            label="Blocked"
            value={formatInt(snapshot.totals.blockedCount)}
            tone="alert"
            helper={`${blockedRatio}% of total`}
            icon={<IconBlock className="stat-icon-svg" />}
          />
          <StatCard
            label="Credits"
            value={formatInt(snapshot.totals.creditsConsumed)}
            helper="Weighted by endpoint cost"
            icon={<IconCoins className="stat-icon-svg" />}
          />
          <StatCard
            label="Redis"
            value={snapshot.totals.redis.status}
            tone={redisTone(snapshot.totals.redis.status)}
            helper={`Circuit failures: ${formatInt(snapshot.totals.redis.failures)}`}
            icon={<IconDatabase className="stat-icon-svg" />}
          />
          <StatCard
            label="Budget ×"
            value={formatMultiplier(snapshot.totals.controller.multiplier)}
            tone={budgetHealthTone}
            helper={snapshot.totals.controller.reason}
            icon={<IconSliders className="stat-icon-svg" />}
          />
        </section>

        <section className="feature-grid">
          <InstanceStrip instances={snapshot.instances ?? []} />
          <section className="card chart-card">
            <PanelHead
              title="Allow vs block"
              subtitle="Recent one-second windows from all gateway instances."
              accent="default"
              icon={<IconBarsSplit className="panel-head-icon-svg" />}
            />
            <MiniBars history={snapshot.history} />
          </section>
        </section>

        <section className="panel-grid panel-grid-trio">
          <section className="card status-card status-card-compact">
            <PanelHead
              title="Degraded posture"
              subtitle="Redis failover, controller health, and policy fallback modes."
              accent="warn"
              icon={<IconShield className="panel-head-icon-svg" />}
            />
            <div className="status-stack">
              <div className="status-kv">
                <span className="eyebrow">Redis health</span>
                <strong className="status-kv-value">{snapshot.totals.redis.status}</strong>
              </div>
              <div className="status-kv">
                <span className="eyebrow">Controller</span>
                <strong className="status-kv-value">{snapshot.totals.controller.health}</strong>
              </div>
              <div className="status-kv">
                <span className="eyebrow">Degraded active</span>
                <strong className="status-kv-value">{snapshot.totals.degraded.active ? "Yes" : "No"}</strong>
              </div>
            </div>
          </section>

          <ChartPanel
            title="Controller trend"
            description="Budget multiplier over recent telemetry buckets."
            variant="trend"
            accent="healthy"
          >
            <Sparkline
              points={snapshot.controllerHistory ?? []}
              valueKey="multiplier"
              tone="healthy"
              formatValue={(v) => (typeof v === "number" && Number.isFinite(v) ? v.toFixed(2) : "—")}
            />
          </ChartPanel>

          <ChartPanel
            title="Redis stability"
            description="Circuit-breaker failure counts merged from gateway ticks."
            variant="redis"
            accent="warn"
          >
            <Sparkline
              points={snapshot.redisTimeline ?? []}
              valueKey="failures"
              tone="warn"
              formatValue={(v) => (typeof v === "number" && Number.isFinite(v) ? String(Math.round(v)) : "—")}
            />
          </ChartPanel>
        </section>

        <section className="panel-grid panel-grid-equal">
          <TimelineCard
            title="Degraded timeline"
            subtitle="Recent FAIL_OPEN / FAIL_SOFT / FAIL_CLOSED signals by gateway."
            icon={<IconHistory className="panel-head-icon-svg" />}
            iconAccent="warn"
            items={(snapshot.degradedTimeline ?? []).slice(-6).reverse()}
            emptyMessage="When you stop Redis or trigger policy fallbacks, degraded decisions appear here with instance context."
            format={(item) => (
              <>
                <strong className="timeline-item-primary">{item.instanceId}</strong>
                <span className="timeline-item-secondary">{summarizeDegradedModes(item.modes)}</span>
              </>
            )}
          />
          <TimelineCard
            title="Controller reasons"
            subtitle="Rule-based multiplier adjustments from the adaptive controller."
            icon={<IconSliders className="panel-head-icon-svg" />}
            iconAccent="healthy"
            items={(snapshot.controllerHistory ?? []).slice(-6).reverse()}
            format={(item) => (
              <>
                <strong className="timeline-item-primary timeline-item-reason">{item.reason}</strong>
                <span className="timeline-item-metric">× {formatMultiplier(item.multiplier)}</span>
              </>
            )}
          />
        </section>

        <section className="lower-head">
          <div className="lower-head-title">
            <div className="panel-head-icon panel-head-icon--default" aria-hidden="true">
              <IconServer className="panel-head-icon-svg" />
            </div>
            <div>
              <p className="eyebrow">Per-instance</p>
              <h2>Gateway throughput</h2>
            </div>
          </div>
          <div className={`degraded-observation ${hasDegradedEvents ? "observed" : "clear"}`}>
            <span className="degraded-dot" />
            <strong>{hasDegradedEvents ? "Degraded events observed" : "No degraded events observed"}</strong>
          </div>
        </section>

        <section className="spark-grid">
          {Object.entries(snapshot.instanceSeries ?? {}).map(([instanceId, points]) => (
            <section key={instanceId} className="card chart-card">
              <PanelHead
                compact
                title={instanceId}
                subtitle="Requests per telemetry bucket."
                accent="default"
                icon={<IconSparkline className="panel-head-icon-svg" />}
              />
              <Sparkline points={points} valueKey="totalRequests" tone="default" />
            </section>
          ))}
        </section>

        <section className="table-grid">
          <TableCard
            title="Top tenants by credits"
            className="table-card-premium"
            icon={<IconUsers className="panel-head-icon-svg" />}
            iconAccent="default"
            columns={["Tenant", "Requests", "Credits", "Denied"]}
            rows={snapshot.topTenants.map((tenant) => ({
              tenant: tenant.key,
              requests: formatInt(tenant.requests),
              credits: formatInt(tenant.credits),
              denied: formatInt(tenant.denied)
            }))}
            getKey={(row) => row.tenant}
            emptyMessage="No tenant traffic recorded in the current window."
          />

          <TableCard
            title="Top endpoints by cost"
            className="table-card-premium"
            icon={<IconRoute className="panel-head-icon-svg" />}
            iconAccent="default"
            columns={["Route", "Requests", "Credits", "p95", "Dyn ×", "Band"]}
            rows={snapshot.topEndpoints.map((endpoint) => ({
              route: endpoint.key,
              requests: formatInt(endpoint.requests),
              credits: formatInt(endpoint.credits),
              latency: `${formatInt(endpoint.latencyP95)} ms`,
              multiplier: formatMultiplier(endpoint.dynamicMultiplier ?? 1),
              band: endpoint.latencyBand ?? "normal"
            }))}
            getKey={(row) => row.route}
            emptyMessage="No route-level cost data yet."
          />

          <TableCard
            title="Top deny reasons"
            className="table-card-premium"
            icon={<IconDeny className="panel-head-icon-svg" />}
            iconAccent="risk"
            columns={["Reason", "Count"]}
            rows={snapshot.topReasons.map((reason) => ({
              reason: reason.reason,
              count: formatInt(reason.count)
            }))}
            getKey={(row) => row.reason}
            emptyMessage="No denials in the merged window — or only allows so far."
          />
        </section>
      </main>
    </div>
  )
}

export default App
