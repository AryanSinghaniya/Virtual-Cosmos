# 🌌 Virtual Cosmos: Real-Time 2D Spatial & AI Proximity Platform

## 🎬 Demo Video Link
**[Watch the Loom Demo Video](https://www.loom.com/share/d0836e7654404daa821c420112740b49)**

[![CI Pipeline](https://github.com/AryanSinghaniya/Virtual-Cosmos/actions/workflows/ci.yml/badge.svg)](https://github.com/AryanSinghaniya/Virtual-Cosmos/actions/workflows/ci.yml)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%20%28Python%203.12%29-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2016%20%2B%20PostGIS%20%2B%20pgvector-336791.svg?logo=postgresql)](https://www.postgresql.org)
[![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20TypeScript%20%2B%20Zustand-61DAFB.svg?logo=react)](https://react.dev)
[![Docker](https://img.shields.io/badge/Containerization-Docker%20%26%20Compose-2496ED.svg?logo=docker)](https://www.docker.com)
[![AWS](https://img.shields.io/badge/Cloud-AWS%20ECS%20%7C%20RDS%20%7C%20CloudFront-FF9900.svg?logo=amazon-aws)](https://aws.amazon.com)

**Virtual Cosmos** is a high-performance, real-time 2D virtual environment and spatial collaboration engine. Users navigate a continuous coordinate world where proximity automatically establishes audio/video peer sessions, encrypted ephemeral chat channels, and AI-powered profile matchmaking using vector embeddings.

---

## 🏗️ Architecture & Technology Stack

```
                               ┌────────────────────────────────────────────────────────┐
                               │               React 18+ Client (TypeScript)           │
                               │   - Zustand State Management (Atomic Stores)           │
                               │   - HTML5 Canvas 60fps Spatial Interpolation           │
                               │   - WebRTC Peer-to-Peer Audio/Video & Screen Sharing   │
                               └───────────────────────┬────────────────────────────────┘
                                                       │ (REST API & Real-time WebSockets)
                                                       ▼
                               ┌────────────────────────────────────────────────────────┐
                               │             FastAPI Backend (Python 3.12)              │
                               │   - Async ASGI Engine (Uvicorn) & Dependency Injection │
                               │   - Sub-millisecond Spatial Proximity Engine           │
                               │   - SlowAPI Token-Bucket Rate Limiting                 │
                               │   - JWT Bearer Authentication & Refresh Token Rotation │
                               └───────────────────────┬────────────────────────────────┘
                                                       │
                                ┌──────────────────────┴──────────────────────┐
                                ▼                                             ▼
       ┌──────────────────────────────────────────────┐     ┌──────────────────────────────────┐
       │     PostgreSQL 16 Relational Storage         │     │         Redis 7 (In-Memory)      │
       │  - PostGIS Geometry (GIST Spatial Index)     │     │  - Token-bucket Rate Limiter     │
       │  - pgvector Embeddings (HNSW Indexing)       │     │  - Distributed WebSocket Pub/Sub │
       │  - Alembic Asynchronous Database Migrations  │     └──────────────────────────────────┘
       └──────────────────────────────────────────────┘
```

### Core Tech Stack

| Layer | Technologies & Frameworks | Key Capabilities |
| :--- | :--- | :--- |
| **Backend** | Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0 Async, Asyncpg, SlowAPI | Asynchronous REST endpoints, OpenAPI docs, sub-millisecond proximity loop |
| **Database** | PostgreSQL 16, PostGIS, pgvector, Alembic | Spatial `ST_DWithin` indexing, HNSW vector cosine similarity search |
| **Frontend** | React 18/19, TypeScript, Zustand, TailwindCSS, HTML5 Canvas 2D | Centralized reactive stores, 60fps smooth movement interpolation |
| **Real-Time** | WebSockets, WebRTC (Mesh Audio/Video/Screen) | Bidirectional coordinate sync, P2P video calling, proximity audio |
| **DevOps & Cloud**| Docker (Multi-stage), Docker Compose, AWS (ECS Fargate, RDS, S3/CloudFront), GitHub Actions CI/CD | Zero-downtime deployments, non-root containers, automated CI verification |

---

## ✨ Key Features

1. **Spatial Proximity Engine (PostGIS & 2D Coordinate Grid)**:
   - Dynamic real-time calculation: `distance = sqrt((x1 - x2)^2 + (y1 - y2)^2)`.
   - Proximity auras and deterministic room keys (`proximity:{min_id}:{max_id}`) created when distance is within threshold (`160px`).
2. **AI Semantic Profile Matchmaker (pgvector & HNSW)**:
   - User bios, skills, and interests are embedded into normalized dense vector space (`Vector(384)`).
   - Instant cosine distance query calculates affinity scores and matches peers with shared technical passions.
3. **Peer-to-Peer WebRTC Audio/Video/Screen Calling**:
   - Integrated signaling gateway (`webrtc:offer`, `webrtc:answer`, `webrtc:candidate`, `webrtc:call-user`, `webrtc:hangup`).
   - In-app incoming call notifications, mic mute, camera toggle, and desktop screen sharing.
4. **Production-Grade REST API with Security & Rate Limiting**:
   - JWT Access & Refresh token rotation with bcrypt password hashing.
   - SlowAPI rate limiting to safeguard auth (20 req/min) and chat endpoints against abuse.
   - Cursor and offset pagination on space rosters and chat histories.
5. **Radar Minimap & Interactive HUD**:
   - Real-time radar displaying world borders and live peer blips.
   - Proximity peer roster strip and interactive sticker tray (`🚀`, `🛰️`, `💻`, `🤖`, `🔥`).

---

## 🚀 Quickstart & Local Development

### Prerequisites
- Python 3.12+
- Node.js 20+ & npm
- Docker & Docker Compose (optional for full-stack containerization)

### Option 1: Run with Docker Compose (FastAPI + PostgreSQL + pgvector + Redis + React)
```bash
# Clone the repository
git clone https://github.com/AryanSinghaniya/Virtual-Cosmos.git
cd Virtual-Cosmos

# Spin up all containerized services
docker-compose up --build
```
* **Frontend**: http://localhost:3000
* **Backend API**: http://localhost:8000
* **Swagger API Documentation**: http://localhost:8000/docs

---

### Option 2: Run Locally (Standalone)

#### 1. Start the FastAPI Backend
```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Run automated tests
pytest -v

# Start development server
python -m uvicorn app.main:app --reload --port 8000
```

#### 2. Start the React TypeScript Frontend
```bash
cd client

# Install dependencies
npm install

# Run TypeScript type check
npm run typecheck

# Start Vite development server
npm run dev
```
* Frontend runs at `http://localhost:5173`.

---

## 📡 API Endpoint Overview

| Method | Endpoint | Description | Rate Limit |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Register new user & provision profile | 20 / min |
| `POST` | `/api/v1/auth/login` | Authenticate & issue JWT access + refresh tokens | 20 / min |
| `POST` | `/api/v1/auth/refresh` | Refresh expired access token | 60 / min |
| `GET` | `/api/v1/auth/me` | Fetch authenticated user profile & skills | 120 / min |
| `GET` | `/api/v1/spaces` | Paginated list of virtual cosmos worlds | 120 / min |
| `POST` | `/api/v1/spatial/proximity-scan` | PostGIS spatial proximity detection scan | 120 / min |
| `POST` | `/api/v1/ai/match` | pgvector cosine similarity profile matchmaking | 30 / min |
| `GET` | `/api/v1/chat/history` | Paginated chat messages by room key | 120 / min |
| `POST` | `/api/v1/chat` | Persist and send direct/proximity chat message | 60 / min |
| `WS` | `/api/v1/ws/cosmos/{space_id}` | Asynchronous multiplayer WebSocket engine | Real-time |

---

## 🧪 Testing & Quality Assurance

```bash
# Run backend pytest suite
cd backend && pytest -v

# Run frontend TypeScript typecheck
cd client && npm run typecheck

# Run production frontend bundle
cd client && npm run build
```

---

## ☁️ AWS Production Deployment

See our dedicated [AWS Architecture Guide](file:///d:/imprtanat%20data/projects/virtual%20cosmos/deploy/aws/architecture.md) for full configuration details on deploying to **AWS ECS Fargate**, **Amazon RDS Aurora PostgreSQL**, **Amazon ElastiCache Redis**, and **CloudFront + S3**.

---

<<<<<<< HEAD
Given users A and B:

`distance = sqrt((Ax - Bx)^2 + (Ay - By)^2)`

- connect if `distance < PROXIMITY_RADIUS`
- disconnect if `distance >= PROXIMITY_RADIUS`

## Demo Video Checklist (2-5 mins)

Show these in order:
1. Open two browser tabs/windows as separate users
2. Demonstrate movement with keyboard
3. Show both users visible in real time
4. Move close and show chat panel auto-enables
5. Exchange messages
6. Move apart and show chat panel auto-disconnect behavior


=======
## 📄 License
This project is licensed under the MIT License.
>>>>>>> e426f0f (Convert Virtual Cosmos to FastAPI, PostgreSQL, PostGIS, pgvector, WebRTC multi-user calling, and Docker)
