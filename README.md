# Spur AI Live Chat Agent

A full-stack AI-powered live chat support agent for a fictional e-commerce store. Built as a take-home assignment for Spur.

## 🚀 Live Deployments

| Layer | URL |
|-------|-----|
| **Frontend (Vercel)** | [https://spur-assignment-sable.vercel.app](https://spur-assignment-sable.vercel.app) |
| **Backend (Render)** | [https://spur-assignment-backend-hiv1.onrender.com](https://spur-assignment-backend-hiv1.onrender.com) |
| **Health Check** | [https://spur-assignment-backend-hiv1.onrender.com/health](https://spur-assignment-backend-hiv1.onrender.com/health) |

## Features

- **Real-time AI Chat** — Interactive chat widget with user/AI message distinction
- **Streaming Responses** — Token-by-token SSE streaming with blinking cursor indicator
- **Conversation History** — Sidebar listing all past conversations; click to open and continue any chat
- **Idempotent Requests** — Built-in idempotency key support prevents duplicate message processing
- **LLM Integration** — Powered by Groq API (llama-3.3-70b-versatile) with OpenAI-compatible SDK
- **Conversation Persistence** — PostgreSQL-backed with Prisma ORM
- **Redis Caching** — Conversation data, history, & FAQ responses cached with cache-aside pattern; configurable TTLs
- **Rate Limiting** — Redis-backed rate limiting to prevent abuse (graceful fallback without Redis)
- **Input Validation** — Empty/long message handling, graceful error recovery
- **Responsive Design** — Works on mobile and desktop; sidebar collapses on smaller screens
- **69 Automated Tests** — 59 backend tests + 10 frontend tests — all passing (Vitest)
- **TypeScript** — Strict mode, zero compilation errors (backend)
- **Svelte Check** — Zero errors and zero warnings (frontend)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | SvelteKit 5 + TypeScript + Vite (deploys to Vercel) |
| **Backend** | Node.js + Express + TypeScript (deploys to Render) |
| **Database** | PostgreSQL (via Prisma ORM) |
| **Cache** | Redis 7 (Docker, optional) |
| **LLM** | Groq API (llama-3.3-70b-versatile) |

## Prerequisites

- **Node.js** >= 18 (v22.17.0 recommended)
- **npm** >= 10
- **PostgreSQL** — installed and running locally
- **Docker** — for Redis (optional, app works without it)
- **Groq API Key** — [Get one free at groq.com](https://groq.com/)

## Quick Start

> **Important:** All backend commands must be run from the `backend/` directory. All frontend commands must be run from the `frontend/` directory.

> ✅ **Verified:** All 59 backend tests, 10 frontend tests, TypeScript compilation, and Svelte checks pass cleanly.

### 1. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
cd ..
```

### 2. Set Up Environment Variables

**Backend** — Copy and edit `backend/.env.example` to `backend/.env`:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your real values:

```env
# Server
PORT=3001

# PostgreSQL Database — MUST be a real running database
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/spur_chat"

# Groq LLM API — REQUIRED: Get your key at https://console.groq.com/keys
GROQ_API_KEY="gsk_..."
GROQ_BASE_URL="https://api.groq.com/openai/v1"
GROQ_MODEL="llama-3.3-70b-versatile"

# LLM Configuration
LLM_MAX_TOKENS=500
LLM_MAX_MESSAGES=20
LLM_TEMPERATURE=0.7

# Redis Cache (optional — app works without Redis)
REDIS_URL="redis://localhost:6379"
REDIS_ENABLED="true"
CACHE_TTL_CONVERSATION=300        # Seconds to cache conversation data (default: 5 min)
CACHE_TTL_HISTORY=60              # Seconds to cache message history (default: 1 min)
CACHE_TTL_FAQ=3600                # Seconds to cache FAQ responses (default: 1 hour)

# Idempotency
IDEMPOTENCY_TTL=3600              # Seconds to keep idempotency keys (default: 1 hour)

# Rate Limiting (optional — requires Redis)
RATE_LIMIT_CHAT_MAX=20            # Max chat requests per window
RATE_LIMIT_CHAT_WINDOW=60         # Rate limit window in seconds
RATE_LIMIT_HEALTH_MAX=30          # Max health check requests per window
RATE_LIMIT_HEALTH_WINDOW=60       # Rate limit window in seconds

# Frontend URL (for CORS)
FRONTEND_URL="http://localhost:5173"
```

### 3. Create PostgreSQL Database

Make sure PostgreSQL is running, then create the database:

```bash
# Option A — using createdb
createdb -U postgres spur_chat

# Option B — using psql
psql -U postgres -c "CREATE DATABASE spur_chat;"
```

### 4. Run Database Migrations

```bash
cd backend
npx prisma migrate dev --name init
```

This creates the `conversations` and `messages` tables.

### 5. Start Redis (Optional)

```bash
# From the project root
docker compose up -d
```

### 6. Start the Backend

**For development (with hot reload):**

```bash
cd backend
npm run dev
```

> The backend starts on `http://localhost:3001`. Verify it's running:
> ```bash
> curl http://localhost:3001/health
> # → {"status":"ok","timestamp":"...","cache":{"connected":false,...}}
> ```

**For production (builds TypeScript first):**

```bash
cd backend
npm start
```

### 7. Start the Frontend

```bash
cd frontend
npm run dev
```

The frontend starts on `http://localhost:5173`.

### 8. Open the App

Navigate to [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🚀 Deployment Guide (Step-by-Step)

### Deploy Backend to Render (Free Tier)

#### Step 1 — Create PostgreSQL Database

1. Go to [https://dashboard.render.com](https://dashboard.render.com) → **Sign in with GitHub**
2. Click **New +** → **PostgreSQL**
3. Fill in:

   | Field | Value |
   |-------|-------|
   | **Name** | `spur-assignment-db` |
   | **Database** | `spur_chat` |
   | **User** | `postgres` |
   | **Plan** | **Free** ($0/month) |
   | **Region** | Choose closest to you |

4. Click **Create Database** and wait ~2 minutes
5. Copy the **Internal Database URL** (starts with `postgresql://...`) — save this for Step 2

#### Step 2 — Create Web Service

1. Click **New +** → **Web Service**
2. Connect your GitHub repo: `pradeepsimha99/spur-assignment`
3. Configure:

   | Field | Value |
   |-------|-------|
   | **Name** | `spur-assignment-backend` |
   | **Runtime** | `Node` |
   | **Root Directory** | `backend` |
   | **Build Command** | `npm install && npx prisma generate && npm run build` |
   | **Start Command** | `npx prisma migrate deploy && node dist/index.js` |
   | **Plan** | **Free** |
   | **Health Check Path** | `/health` |

4. Click **Advanced** → **Add Environment Variables**:

   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `PORT` | `3001` |
   | `DATABASE_URL` | *(Internal Database URL from Step 1)* |
   | `GROQ_API_KEY` | *(Your Groq API key)* |
   | `GROQ_BASE_URL` | `https://api.groq.com/openai/v1` |
   | `GROQ_MODEL` | `llama-3.3-70b-versatile` |
   | `LLM_MAX_TOKENS` | `500` |
   | `LLM_MAX_MESSAGES` | `20` |
   | `LLM_TEMPERATURE` | `0.7` |
   | `REDIS_ENABLED` | `false` |
   | `FRONTEND_URL` | `https://spur-assignment-sable.vercel.app` *(update after Vercel deploy)* |

5. Click **Create Web Service**
6. Wait ~5 minutes for build. Verify with:
   ```bash
   curl https://spur-assignment-backend-hiv1.onrender.com/health
   # → {"status":"ok",...}
   ```

### Deploy Frontend to Vercel (Free Tier)

#### Step 1 — Import Project

1. Go to [https://vercel.com](https://vercel.com) → **Sign in with GitHub**
2. Click **Add New...** → **Project**
3. Select `pradeepsimha99/spur-assignment`
4. Click **Import**

#### Step 2 — Configure Project

| Setting | Value |
|---------|-------|
| **Framework Preset** | SvelteKit (auto-detected) |
| **Root Directory** | `frontend` |
| **Build Command** | `npm run build` (auto-filled) |
| **Output Directory** | `build` (auto-filled) |
| **Install Command** | `npm install` |

#### Step 3 — Add Environment Variables

Click **Environment Variables** and add:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://spur-assignment-backend-hiv1.onrender.com` |

> ⚠️ **Important:** The code automatically strips any trailing slash, so `https://spur-assignment-backend-hiv1.onrender.com` and `https://spur-assignment-backend-hiv1.onrender.com/` both work fine.

#### Step 4 — Deploy

1. Click **Deploy**
2. Wait ~2 minutes for build
3. Your frontend URL: `https://spur-assignment-sable.vercel.app`

#### Step 5 — Link Backend → Frontend

Go back to **Render Dashboard** → `spur-assignment-backend` → **Environment** → Update:

| Key | Value |
|-----|-------|
| `FRONTEND_URL` | `https://spur-assignment-sable.vercel.app` |

Click **Manual Deploy** → **Deploy latest commit** to restart the backend.

### Post-Deployment Verification

```bash
# Test backend health
curl https://spur-assignment-backend-hiv1.onrender.com/health

# Test CORS headers (should return the origin header)
curl -H "Origin: https://spur-assignment-sable.vercel.app" \
  https://spur-assignment-backend-hiv1.onrender.com/health -I

# Test conversations endpoint
curl https://spur-assignment-backend-hiv1.onrender.com/chat/conversations

# Test chat message
curl -X POST https://spur-assignment-backend-hiv1.onrender.com/chat/message \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello","idempotencyKey":"test-1"}'
```

> 💡 **Reminder:** If you haven't already, set `FRONTEND_URL` on Render to `https://spur-assignment-sable.vercel.app` and redeploy the backend (see Step 5 above).

Then open `https://spur-assignment-sable.vercel.app` in your browser and verify:
- ✅ Chat widget loads with sidebar
- ✅ Sending a message works with streaming response
- ✅ Conversation appears in sidebar after sending
- ✅ Click conversation to reopen history

---

## Troubleshooting

### CORS Errors in Production

**Symptom:** Browser shows CORS errors when frontend tries to call backend.

**Causes & Fixes:**

| Cause | Fix |
|-------|-----|
| `FRONTEND_URL` not set on Render | Set `FRONTEND_URL` env var in Render dashboard to your Vercel URL |
| `VITE_API_URL` not set on Vercel | Set `VITE_API_URL` env var in Vercel project settings to your Render URL |
| Trailing slash mismatch | The code strips trailing slashes automatically. Ensure `VITE_API_URL` has no trailing slash when setting it |
| Wrong URL format | Make sure there's no `https://` duplication. Example: `https://spur-assignment-backend-hiv1.onrender.com` (correct) |

### Double Slash in URLs (`//chat/message`)

**Symptom:** Requests go to `https://...//chat/message` and return 404.

**Fix:** If you set `VITE_API_URL` on Vercel with a trailing slash, the frontend now strips it automatically. Just redeploy the frontend after pulling the latest code.

### Backend 404 on `/chat/conversations`

**Symptom:** Getting `Cannot GET /chat/conversations` even though the route exists in code.

**Fix:** The backend server is running old code. Go to Render → **Manual Deploy** → **Deploy latest commit**. The `GET /chat/conversations` route was added in a recent update.

### Render Free Tier — App is Slow

**Cause:** Free tier sleeps after 15 minutes of inactivity. First request takes ~30 seconds to wake up.

**Fix:** This is normal. Just wait for the response.

---

## Conversation Sidebar

The frontend includes a **conversation sidebar** that lists all past conversations:

- **Desktop**: Sidebar is visible by default on the left; toggle with the hamburger (☰) button
- **Mobile**: Sidebar slides in as an overlay; hidden by default
- **Click any conversation** to load its history and continue chatting
- **New Conversation** button creates a fresh chat
- **Auto-refresh**: The list refreshes after each message is sent

## Idempotency (Duplicate Protection)

Every chat message is protected against duplicate processing:

- Each message sent from the frontend includes a unique `idempotencyKey` (UUID)
- The backend checks if it has already processed a request with the same key
- If yes, the cached response is returned immediately — no LLM call or DB write is made
- Idempotency keys expire after 1 hour (configurable via `IDEMPOTENCY_TTL`)
- **Fallback**: Uses Redis if available, otherwise an in-memory store (capped at 1000 entries)

## CORS Configuration

The backend CORS is configured to accept requests from multiple origins:

```ts
const allowedOrigins = [
  'http://localhost:5173',           // Local frontend dev server
  'http://localhost:3001',           // Local backend
  'https://spur-assignment-sable.vercel.app', // Production Vercel URL
];
```

Additionally, the `FRONTEND_URL` environment variable adds your custom frontend URL. The CORS handler:
- Strips trailing slashes from origins before comparing
- Supports `OPTIONS` preflight requests
- Sets `credentials: true` for cookie/auth support
- Logs blocked origins to the console for debugging

## Running Tests

### Backend Tests (59 tests)

```bash
cd backend
npm test
```

Tests cover:
- **Validation middleware** (11 tests) — empty messages, long messages, missing fields, sessionId/idempotencyKey validation
- **LLM service** (7 tests) — Groq API integration, error handling (401, 429, timeout), conversation history
- **Conversation service** (7 tests) — CRUD operations, session creation, message persistence
- **Chat routes** (12 tests) — Full request/response cycle, error scenarios, session handling, **idempotency** (2 tests)
- **Health check** (1 test) — Endpoint returns status ok with cache info
- **Redis cache** (17 tests) — Cache stats, key generation, TTL config, graceful degradation
- **Rate limiting** (4 tests) — Redis-backed rate limiter with graceful fallback

### Frontend Tests (10 tests)

```bash
cd frontend
npx vitest run
```

Tests cover:
- **API client** — sendMessage, fetchMessages, listConversations, idempotency key generation, error handling, URL encoding

## API Reference

### `POST /chat/message`

Send a message and get an AI reply (with idempotency support).

**Request:**
```json
{
  "message": "What's your return policy?",
  "sessionId": "optional-existing-session-uuid",
  "idempotencyKey": "optional-unique-key-to-prevent-duplicates"
}
```

**Response:**
```json
{
  "reply": "Our return policy allows returns within 30 days...",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "idempotencyKey": "returned-if-provided-in-request"
}
```

### `POST /chat/message/stream`

Same as `/chat/message` but streams the AI reply token-by-token via Server-Sent Events (SSE). Also supports `idempotencyKey`.

### `GET /chat/conversations`

List all conversations ordered by most recent first.

**Response:**
```json
{
  "conversations": [
    {
      "id": "conv-uuid",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "lastMessageAt": "2026-01-02T00:00:00.000Z",
      "preview": "What's your return policy?",
      "messageCount": 5
    }
  ]
}
```

### `GET /chat/:sessionId/messages`

Fetch all messages for an existing session.

### `GET /health`

Health check endpoint with cache status.

## Manual End-to-End Verification

```bash
# 1. Health check
curl http://localhost:3001/health

# 2. List conversations (empty initially)
curl http://localhost:3001/chat/conversations

# 3. Send a message with idempotency key
curl -X POST http://localhost:3001/chat/message \
  -H "Content-Type: application/json" \
  -d '{"message": "What is your return policy?", "idempotencyKey": "my-unique-key-1"}'

# 4. Re-send the same idempotency key (returns cached response)
curl -X POST http://localhost:3001/chat/message \
  -H "Content-Type: application/json" \
  -d '{"message": "What is your return policy?", "idempotencyKey": "my-unique-key-1"}'
# → Same reply returned WITHOUT calling LLM again

# 5. Fetch conversation history
curl http://localhost:3001/chat/YOUR_SESSION_ID/messages

# 6. List conversations (now has entries)
curl http://localhost:3001/chat/conversations
```

## Architecture Overview

```
spur-assignment/
├── backend/
│   ├── Dockerfile                # Production Docker image
│   └── src/
│       ├── index.ts              # Express server (dotenv, CORS, rate limiting)
│       ├── routes/
│       │   ├── chat.ts           # Chat routes: /message, /message/stream, /conversations, /:sessionId/messages
│       │   ├── chat.test.ts      # 12 integration tests (supertest)
│       │   └── health.test.ts    # Health check test
│       ├── services/
│       │   ├── llm.ts            # Groq/LLM integration (non-streaming + streaming)
│       │   ├── llm.test.ts       # 7 LLM service tests
│       │   ├── conversation.ts   # DB CRUD + Redis caching + conversation listing
│       │   ├── conversation.test.ts # 7 conversation service tests
│       │   └── idempotency.ts    # Redis-backed idempotency with in-memory fallback
│       ├── middleware/
│       │   ├── validation.ts     # Request validation (message, sessionId, idempotencyKey)
│       │   ├── validation.test.ts # 11 validation tests
│       │   ├── rateLimit.ts      # Redis-backed rate limiting
│       │   └── rateLimit.test.ts # 4 rate limiting tests
│       ├── models/
│       │   └── types.ts          # Shared TypeScript types
│       ├── cache/
│       │   ├── redis.ts          # Redis client with stats, cache-aside, invalidation
│       │   └── redis.test.ts     # 17 Redis cache tests
│       └── test-setup.ts         # Global mocks (Prisma, OpenAI, Redis)
├── frontend/
│   ├── Dockerfile                # Production Docker image
│   └── src/
│       ├── routes/
│       │   └── +page.svelte      # Main chat page
│       └── lib/
│           ├── api.ts            # HTTP client (JSON + SSE streaming + idempotency)
│           ├── api.test.ts       # 10 API client tests
│           ├── types.ts          # Shared TypeScript types
│           └── components/
│               ├── ChatWidget.svelte        # Main orchestrator + conversation management
│               ├── ConversationList.svelte  # Sidebar: past conversations
│               ├── MessageList.svelte       # Scrollable message list
│               └── MessageInput.svelte      # Input box with send button
├── docker-compose.yml            # Full-stack: PostgreSQL + Redis + Backend + Frontend
├── vercel.json                   # Vercel deployment config
├── .gitignore
└── README.md
```

### Backend Layers

1. **Routes Layer** (`routes/chat.ts`) — HTTP request handling, delegates to services
2. **Service Layer** (`services/`) — Business logic:
   - `llm.ts` — LLM integration, prompt construction, error handling
   - `conversation.ts` — Database CRUD for conversations & messages
   - `idempotency.ts` — Duplicate request detection & caching
3. **Middleware Layer** (`middleware/validation.ts`) — Input validation, global error handler
4. **Cache Layer** (`cache/redis.ts`) — Optional Redis caching with graceful degradation

### Design Decisions

- **Layered architecture** — Clear separation of concerns makes it easy to add new channels (WhatsApp, Instagram, etc.) by adding new route handlers that reuse existing services.
- **LLM as a service** — The `generateReply()` function encapsulates all LLM logic. Swapping providers means changing just this one file.
- **Graceful degradation** — Redis is optional. If unavailable, the app still works perfectly. LLM errors return user-friendly messages instead of crashing.
- **Idempotency** — Duplicate requests are detected and cached responses returned without hitting the LLM or DB. Uses Redis with in-memory fallback.
- **Conversation history** — Messages are persisted and reloaded on page refresh. A sidebar shows all past conversations, clickable to continue.
- **Multi-layered Redis caching** — Three cache layers with configurable TTLs.
- **Cache-aside pattern** — Data loaded into cache on read, invalidated on write.
- **dotenv loading** — Backend loads `.env` via `import 'dotenv/config'`. Must run from `backend/` directory.

## LLM Notes

### Provider: Groq

We use **Groq's API** with the **llama-3.3-70b-versatile** model.

### Prompt Strategy

The system prompt includes a complete fictional store profile (SpurStore) with shipping/return policies, support hours, and contact info. Conversation history (last 20 messages) is included with each request.

### Cost Control

- Max tokens: 500 per response (configurable)
- Max history: 20 messages (configurable)
- FAQ caching: Simple questions cached for 1 hour

## Trade-offs & "If I Had More Time…"

1. **Conversation sidebar** — ✅ **Implemented** — Past conversations listed and clickable.
2. **Idempotency** — ✅ **Implemented** — Redis-backed with in-memory fallback.
3. **Atomic idempotency** — Use Redis `SET NX` to guarantee exactly-once processing even under concurrent requests.
4. **Conversation pagination** — Add cursor-based pagination to the conversations list for heavy usage.
5. **Conversation summarization** — For long conversations, summarize older messages to stay within LLM context windows.
6. **WebSocket support** — Replace SSE with WebSockets for true bidirectional streaming.
7. **Admin dashboard** — View all active conversations with analytics.
8. **End-to-end tests** — Integration tests with a real test database and actual LLM calls.

## Project Repository

- **GitHub**: [https://github.com/pradeepsimha99/spur-assignment](https://github.com/pradeepsimha99/spur-assignment)
