# Virtual Cosmos: Cloud Infrastructure & AWS Deployment Architecture

This document provides a production-grade AWS cloud architecture and deployment guide for **Virtual Cosmos**, engineered for high availability, sub-10ms spatial latency, and elastic horizontal scaling.

---

## 1. High-Level AWS Architecture Diagram

```
                              [ Users & WebRTC Peers ]
                                         │
                                         ▼
                             [ AWS CloudFront (CDN) ]
                                         │
                        ┌────────────────┴────────────────┐
                        │ (Static Assets: HTML/JS/CSS)     │ (/api/* & /ws/*)
                        ▼                                  ▼
                [ Amazon S3 Bucket ]            [ Application Load Balancer (ALB) ]
             (React 18+ SPA Production)        (TLS Termination & WebSocket Sticky Sessions)
                                                           │
                                                           ▼
                                               [ AWS ECS Fargate Cluster ]
                                           ┌───────────────────────────────┐
                                           │  FastAPI Container Task 1     │
                                           │  FastAPI Container Task 2     │
                                           │  (Autoscaling: CPU/Conn > 70%)│
                                           └───────────────┬───────────────┘
                                                           │
                                ┌──────────────────────────┴──────────────────────────┐
                                ▼                                                     ▼
                  [ Amazon RDS Aurora PostgreSQL ]                         [ Amazon ElastiCache Redis ]
                 - PostgreSQL 16 + PostGIS + pgvector                     - Cluster Mode (Multi-AZ)
                 - Multi-AZ Read Replicas                                 - WebSocket Pub/Sub & Rate Limiting
                 - Spatial GIST & Vector HNSW Indexes
```

---

## 2. Core AWS Components & Design Decisions

### A. Compute: AWS ECS (Elastic Container Service) on AWS Fargate
* **Why Fargate?** Serverless container compute eliminates EC2 instance management, providing automatic scaling based on WebSocket connection volume and CPU utilization.
* **ASGI Server**: Python 3.12 FastAPI container running with `uvicorn` workers and non-root execution (`cosmos` user).
* **Graceful Shutdown**: SIGTERM handling ensures active WebSocket disconnects are cleanly broadcast to peers before container termination.

### B. Database: Amazon RDS for PostgreSQL (or Aurora Serverless v2)
* **Extensions Enabled**:
  * `postgis`: Enables geospatial functions (`ST_DWithin`, `ST_Distance`) with `GIST` indexes for 2D proximity detection.
  * `vector` (pgvector): Enables vector similarity search (`cosine_distance` `<=>`) with `HNSW` indexes for AI semantic profile matchmaking.
* **Storage & Indexing**:
  * B-Tree composite index on `(room_key, created_at)` for paginated chat history.
  * Spatial GIST index on coordinates for rapid proximity radius calculations.
  * Automated daily snapshots with 30-day point-in-time recovery.

### C. Caching & State Distribution: Amazon ElastiCache for Redis
* **Role 1 (Rate Limiting)**: High-speed sliding window rate limiting for authentication and chat endpoints.
* **Role 2 (Multi-Node WebSocket Pub/Sub)**: When scaling beyond a single ECS container, Redis Pub/Sub synchronizes spatial player movement across container instances.

### D. Networking & Security
* **VPC Configuration**:
  * Public Subnets: ALB and NAT Gateways.
  * Private Subnets: ECS Fargate tasks and RDS PostgreSQL instances (no direct public IP).
* **AWS Secrets Manager / SSM Parameter Store**: Securely injects `DATABASE_URL`, `SECRET_KEY`, and API keys at container runtime.
* **AWS WAF (Web Application Firewall)**: Protects against DDoS and OWASP Top 10 exploits.

---

## 3. Step-by-Step Deployment Guide

### Step 1: Provision RDS PostgreSQL with pgvector & PostGIS
```sql
-- Connect to AWS RDS PostgreSQL as admin
CREATE DATABASE virtual_cosmos;
\c virtual_cosmos;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS postgis;
```

### Step 2: Build & Push Docker Images to Amazon ECR
```bash
# Authenticate to AWS ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com

# Build & Push Backend
docker build -t virtual-cosmos-backend -f deploy/docker/Dockerfile.backend ./backend
docker tag virtual-cosmos-backend:latest <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/virtual-cosmos-backend:latest
docker push <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/virtual-cosmos-backend:latest

# Build & Deploy Frontend to S3 + CloudFront
cd client && npm run build
aws s3 sync dist/ s3://virtual-cosmos-production-static/ --delete
aws cloudfront create-invalidation --distribution-id <DIST_ID> --paths "/*"
```

### Step 3: Run Database Migrations on ECS
```bash
aws ecs run-task \
  --cluster cosmos-cluster \
  --task-definition cosmos-migration-task \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-123],securityGroups=[sg-123],assignPublicIp=ENABLED}"
```
