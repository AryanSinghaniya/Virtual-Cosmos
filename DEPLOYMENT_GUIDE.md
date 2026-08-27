# 🚀 Virtual Cosmos - Production Deployment Guide

This guide covers all deployment paths for **Virtual Cosmos**, tailored for resume demos, cloud hosting, and enterprise infrastructure.

---

## 🌟 Option 1: 100% Free Cloud Deployment (Vercel + Render / Railway)
*Best for live portfolio/resume links without paying for servers.*

### Step 1: Deploy Backend (Render.com)
1. Push your repository to **GitHub**.
2. Go to **[Render.com](https://render.com/)** and click **New + > Web Service** (or use **Blueprints** with `render.yaml`).
3. Connect your GitHub repository.
4. Set the following settings:
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT --ws websockets`
5. Add Environment Variables:
   - `ENVIRONMENT` = `production`
   - `DEBUG` = `False`
   - `SECRET_KEY` = *(generate random string)*
   - `BACKEND_CORS_ORIGINS` = `["*"]`
6. Click **Create Web Service**. Render will deploy your FastAPI backend and give you a public URL (e.g. `https://virtual-cosmos-api.onrender.com`).

---

### Step 2: Deploy Frontend (Vercel)
1. Go to **[Vercel.com](https://vercel.com/)** and click **Add New > Project**.
2. Select your GitHub repository.
3. In the project settings:
   - **Root Directory**: `client`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. In **Environment Variables**, add:
   - `VITE_SERVER_URL` = `https://virtual-cosmos-api.onrender.com` *(your Render backend URL)*
5. Click **Deploy**. Vercel will deploy your React 18 frontend and provide a high-speed global URL (e.g. `https://virtual-cosmos.vercel.app`).

---

## 🐳 Option 2: Docker Compose (Local or VPS / AWS EC2 / DigitalOcean)
*Best for self-hosted single-command deployment.*

### Requirements:
* Docker & Docker Compose installed.

### Deploy in 1 Command:
```bash
docker compose up -d --build
```

### Services Started:
| Service | Image / Port | Description |
| :--- | :--- | :--- |
| **db** | `pgvector/pgvector:pg16` (`5432`) | PostgreSQL with pgvector & PostGIS |
| **redis** | `redis:7-alpine` (`6379`) | Redis cache & pub/sub |
| **backend** | FastAPI (`8000`) | Asynchronous REST & Socket.IO WebSockets |
| **frontend** | React 18 + Nginx (`3000`) | Static single-page application |

* Open **`http://localhost:3000`** in your browser to access the live app!

---

## ☁️ Option 3: Enterprise AWS Cloud Architecture (ECS Fargate + RDS + CloudFront)
*Per the Job Description tech requirements.*

1. **Database**: Provision Amazon RDS PostgreSQL 16 with `pgvector` & `postgis` enabled.
2. **Container Registry**: Push Docker images to **Amazon ECR**.
3. **Backend Service**: Deploy FastAPI container on **AWS ECS Fargate** behind an **Application Load Balancer (ALB)** with WebSocket support.
4. **Frontend**: Build production assets (`npm run build`) and host on **Amazon S3** + **Amazon CloudFront** CDN with SSL/TLS.
5. See [`deploy/aws/architecture.md`](file:///d:/imprtanat%20data/projects/virtual%20cosmos/deploy/aws/architecture.md) for full Terraform & Task Definition templates.
