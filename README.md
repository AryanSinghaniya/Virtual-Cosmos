# Virtual Cosmos Assignment

A real-time 2D virtual environment where users move inside a shared space and can chat only when they are physically close.

## Submit The Following

1. GitHub Repository
- Proper README
- Setup instructions
- Clean code

## Implemented Features

### 1. User Movement
- 2D world rendered with PixiJS
- Each user displayed with an emoji avatar + name label
- Keyboard movement with WASD and Arrow keys
- Movement clamped to world boundaries

### 2. Real-Time Multiplayer
- Every connected user is visible to all others
- Positions are synced via Socket.IO events
- Live world updates broadcast by backend

### 3. Proximity Detection (Core Logic)
- Configurable proximity radius on server
- Distance formula checks every move update
- If distance < radius, users connect
- If distance >= radius, users disconnect

### 4. Proximity Chat System
- Auto room join when users are close
- Auto room leave when users move apart
- Chat panel enables only when at least one active nearby connection exists
- Multiple nearby users supported via per-pair rooms
- Built-in sticker picker for fast emoji-based interaction
- WebRTC call controls with Start/Accept/Reject and ringing state
- Mic and camera toggle controls available during connected call
- Screen sharing toggle during active call

### 5. UI/UX
- Minimal but polished dashboard UI
- Live status badge (connected/disconnected)
- Pixi canvas with world boundary + proximity aura
- Active connection list with peer avatar emojis and contextual chat panel
- Avatar card strip for online users (closer feel to virtual office tools)
- Responsive layout for desktop and mobile

## Tech Stack Used

### Frontend
- React + Vite
- PixiJS (canvas rendering)
- Tailwind dependency enabled (custom CSS-driven final design)
- Socket.IO Client

### Backend
- Node.js + Express
- Socket.IO
- MongoDB support with Mongoose (optional via environment variable)
- In-memory fallback when MongoDB is not configured

## Project Structure

- `client/` React app (UI + Pixi + movement + chat)
- `server/` Express + Socket.IO backend (state + proximity + messaging)
- `assignment.txt` original assignment prompt

## Environment Setup

### Prerequisites
- Node.js 18+
- npm
- Optional: MongoDB running locally or remotely

### 1) Install dependencies
Run from root:

```bash
npm install
npm run install:all
```

### 2) Configure environment

Backend environment:
- Copy `server/.env.example` to `server/.env`
- Update values if needed

Frontend environment:
- Copy `client/.env.example` to `client/.env`
- Set `VITE_SERVER_URL` to your Render backend URL (must be `https://...` in production)

### Deployment Environment Variables (Render + Vercel)

Backend on Render:
- `CLIENT_ORIGIN=https://your-vercel-app.vercel.app`
- Optional: if you use preview/staging domains, set comma-separated origins
- Example: `CLIENT_ORIGIN=https://your-vercel-app.vercel.app,https://your-preview.vercel.app`

Frontend on Vercel:
- `VITE_SERVER_URL=https://your-render-service.onrender.com`

Important:
- Do not use `http://` between Vercel and Render, use `https://` only
- After changing env vars, redeploy both services

If `MONGODB_URI` is not set, backend runs with in-memory state (still fully functional for demo).

### 3) Run in development mode
From root:

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000

### 4) Build frontend

```bash
npm run build
```

## Socket Event Design

### Client -> Server
- `user:register` : register user with name/starting position
- `user:move` : live position update
- `chat:send` : send chat message to active room

### Server -> Client
- `world:init` : initial world state + own identity + radius
- `world:update` : live user position updates
- `connections:update` : active nearby chat connections
- `chat:message` : room chat messages

## Core Proximity Formula

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

## Submission Checklist

1. Push this full codebase to GitHub
2. Include this README
3. Record demo video and include assignment requirements
4. Submit repository + video link in the provided form
