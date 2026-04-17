# Sentinel

Sentinel is a distributed API traffic governance platform that sits beside normal gateway or proxy infrastructure and enforces globally coordinated, cost-aware, tenant-aware, and explainable API control.

## Architecture

- `gateway/`: Fastify governance gateway with API-key auth, policy engine, Redis-backed distributed limiter, fairness checks, degraded modes, explainability headers, and metrics emission
- `backend/`: mock backend with cheap and expensive routes to simulate real cost asymmetry
- `aggregator/`: telemetry merge service with rolling windows, top-k analytics, and SSE stream
- `controller/`: Python adaptive budget controller with bounded rule-based multiplier logic
- `dashboard/`: React live control room for traffic, fairness, deny reasons, Redis health, and adaptive state
- `redis/`: Redis Sentinel quorum configs for primary monitoring and replica promotion
- `tests/`: fairness, degraded-mode, explainability, integration, fault-injection, and Node-based load scripts (see `tests/load/`)

## Core Features

- Global enforcement through Sentinel-managed Redis master discovery
- Cost-based credits for health, user, search, and export endpoints
- Tenant budgets, burst allowances, and max-share fairness guardrails
- Adaptive budget multiplier from latency, error rate, blocked ratio, and throughput
- Explainable decisions via structured headers and deny payloads
- Graceful `FAIL_OPEN`, `FAIL_CLOSED`, and `FAIL_SOFT` behavior
- Live telemetry aggregation with SSE dashboard updates

## Sample API Keys

- `sentinel-free-key`
- `sentinel-pro-key`
- `sentinel-enterprise-key`

## Local Development

1. Install Node workspace dependencies with `npm install`.
2. Install Python dependencies with `pip install -r controller/requirements.txt`.
3. Start services in separate shells:
   - `npm run dev:backend`
   - `npm run dev:aggregator`
   - `npm run dev:gateway`
   - `cd controller && python app.py`
   - `npm run dev:dashboard`

## Docker Compose

Run the full system with:

```bash
docker compose up --build
```

**Dashboard at `http://localhost:8080`:** That port serves **Nginx + a static Vite build** inside the `dashboard` image. Editing files under `dashboard/src/` does **not** change what you see until you **rebuild** the image and recreate the container (or run `npm run dev:dashboard` for hot reload on port 8080 with the aggregator running locally):

```bash
docker compose build dashboard && docker compose up -d dashboard
```

If the browser still shows an old UI, hard-refresh once (`Ctrl+Shift+R`) or run a no-cache build:

```bash
docker compose build --no-cache dashboard && docker compose up -d dashboard
```

Automated end-to-end verification:

```bash
npm run test:e2e
```

Redis limiter edge-case verification:

```bash
npm run test:redis
```

Seed the dashboard with realistic mixed traffic:

```bash
npm run demo:seed
```

For a heavier demo burst:

```bash
npm run demo:seed:burst
```

The Docker-backed E2E harness automatically:

- brings the stack up
- sends normal API traffic and asserts allow headers
- exercises both gateway instances and verifies shared metrics visibility
- proves cross-instance distributed budget enforcement
- forces Redis primary failover and verifies Sentinel promotion
- forces controller outage and verifies requests still succeed with degraded controller state
- forces full Redis outage and verifies `FAIL_OPEN` and `FAIL_CLOSED` gateway behavior
- restores the stack and checks post-recovery health

The Redis edge-case suite validates:

- fixed-window saturation and retry timing
- sliding-window concurrent edge behavior
- token-bucket depletion and refill waits
- tenant budget exhaustion handling

Services:

- Gateway: `http://localhost:3000`
- Gateway 2: `http://localhost:3001`
- Backend: `http://localhost:4000`
- Aggregator: `http://localhost:4100`
- Controller: `http://localhost:5000`
- Dashboard: `http://localhost:8080`

## Demo Scenarios

- Hit `/api/health` repeatedly with the free key and observe low credit consumption.
- Hit `/api/export` with the free key and observe fast budget drain and possible deny decisions.
- Mix `search` and `export` traffic across multiple API keys and watch tenant rankings and deny reasons update live.
- Run `npm run demo:seed` and keep the dashboard open to watch live fairness movement, controller history, degraded timelines, and per-instance activity.
- Stop `redis-primary` and observe Sentinel promoting a replica while the gateway reconnects.
- Stop all Redis nodes and observe route-specific degraded behaviors:
  - health: `FAIL_OPEN`
  - user/search: `FAIL_SOFT`
  - export: `FAIL_CLOSED`

## Explainability Contract

Successful and denied responses include:

- `X-Sentinel-Decision`
- `X-Sentinel-Reason`
- `X-Sentinel-TraceId`
- `X-Credits-Remaining`
- `X-Request-Cost`
- `X-Sentinel-Degraded`

Denied responses return a JSON body with trace ID, reason, route, request cost, remaining credits, retry timing, and degraded mode context.

## Notes

- The controller is intentionally rule-based in v1 so its decisions are explainable and stable.
- Redis Sentinel-based replica promotion is part of the default topology; a single Redis node is not treated as sufficient.
- The production UI lives only under `dashboard/` (Vite + React). Load scenarios use Node drivers in `tests/load/` (for example `sentinel-mixed-traffic.js`); there is no k6 dependency in this repo.
- The dashboard consumes `GET /snapshot` and the `snapshot` SSE event from the aggregator, with chart legends and status panels aligned to gateway telemetry (Redis circuit state, controller multiplier history, degraded timelines).
