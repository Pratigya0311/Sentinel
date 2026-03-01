# Sentinel 🛡️
Distributed, Stateless API Gateway with Adaptive Rate Limiting

## Project Structure
```
sentinel/
├── gateway/           # Node.js + Fastify API Gateway
├── ml-service/        # Python Flask adaptive rate limiting
├── dashboard/         # React real-time monitoring dashboard
├── backend/           # Dummy backend service
└── docker-compose.yml
```

## Setup

### Prerequisites
- Docker Desktop
- Node.js v18+
- Python 3.10+

### Run with Docker
```bash
docker-compose up --build
```

### Local Development
```bash
# Gateway
cd gateway && npm install && npm run dev

# ML Service
cd ml-service && pip install -r requirements.txt && python app.py

# Dashboard
cd dashboard && npm install && npm run dev
```

## Services
| Service | URL |
|---------|-----|
| Gateway | http://localhost:3000 |
| Dashboard | http://localhost:8080 |
| ML Service | http://localhost:5000 |
| Backend | http://localhost:4000 |