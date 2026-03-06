# HemoSync — Local Development

Get HemoSync running locally in under 5 minutes.

---

## 1. Prerequisites

- [Node.js](https://nodejs.org/) v20 LTS (`node --version`)
- [pnpm](https://pnpm.io/installation) v9+ (`pnpm --version`)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for local Redis + PostgreSQL)
- [Azure Functions Core Tools](https://learn.microsoft.com/azure/azure-functions/functions-run-local) v4 (`func --version`)
- An Azure subscription with the services listed in [deployment.md](deployment.md) provisioned (at minimum: Azure OpenAI, ACS, MSG91 account)

---

## 2. Clone and Install

```bash
git clone https://github.com/Varshini3077/Hemosync.git
cd Hemosync
pnpm install
```

---

## 3. Configure Environment

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Open `.env` and fill in the required values. At minimum for local development:

- `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_KEY`
- `MSG91_AUTH_KEY` and `MSG91_SENDER_ID`
- `AZURE_MAPS_SUBSCRIPTION_KEY`
- `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION`

For local PostgreSQL and Redis, the `.env.example` already includes commented-out local overrides:

```dotenv
POSTGRES_HOST=localhost
POSTGRES_USER=hemosync
POSTGRES_PASSWORD=hemosync_dev
POSTGRES_DATABASE=hemosync_audit

REDIS_CONNECTION_STRING=localhost:6379
```

---

## 4. Start Local Dependencies

Start PostgreSQL and Redis using Docker Compose:

```bash
docker-compose up -d
```

Verify containers are running:

```bash
docker-compose ps
```

Both `hemosync-postgres` and `hemosync-redis` should show `Up`.

---

## 5. Seed Local Database

Run migrations and seed data:

```bash
pnpm seed:local
```

This runs all 3 PostgreSQL migrations and inserts 30 blood banks + 50 donor records.

---

## 6. Start All Apps

Start all packages concurrently via Turborepo:

```bash
pnpm dev
```

Turborepo starts the Functions API, web dashboard, Teams bot, and WhatsApp handler in parallel with shared TypeScript watch mode.

---

## 7. Local URLs

| App | URL |
|---|---|
| Web dashboard | http://localhost:5173 |
| Azure Functions API | http://localhost:7071 |
| Teams bot | http://localhost:3978 |
| WhatsApp handler | http://localhost:3000 |

---

## 8. Testing the Teams Bot Locally

The Teams bot can be tested with the **Bot Framework Emulator** without a live Teams tenant:

1. Download [Bot Framework Emulator](https://github.com/microsoft/BotFramework-Emulator/releases)
2. Open the emulator and connect to: `http://localhost:3978/api/messages`
3. Leave App ID and Password blank for local testing (or use dev bot credentials from `.env`)
4. Type a blood request like: `Need 2 units O+ urgently at AIIMS`

The bot will parse, rank, and simulate a broadcast response in the emulator conversation window.

---

## Useful Commands

```bash
pnpm dev          # Start all apps in watch mode
pnpm build        # Build all packages
pnpm test         # Run all unit + integration tests
pnpm test:e2e     # Run Playwright end-to-end tests
pnpm lint         # Run ESLint across all packages
pnpm seed:local   # Seed local PostgreSQL + Cosmos DB emulator
pnpm health-check # Ping all 7 function endpoints
```
