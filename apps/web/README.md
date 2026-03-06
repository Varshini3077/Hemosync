# @hemosync/web — Coordinator Dashboard

React + Vite web application for hospital coordinators to manage emergency blood requests in real time.

## Running locally

```bash
# From the monorepo root
pnpm install
pnpm --filter @hemosync/web dev
```

The dev server starts on `http://localhost:5173`. API calls are proxied to `http://localhost:7071` (Azure Functions local runtime).

To run the Azure Functions API locally:

```bash
cd api && npm start
```

## Environment variables

Create `apps/web/.env.local`:

```env
# Base URL for the API (leave blank to use the /api proxy)
VITE_API_BASE_URL=

# API key sent as x-api-key header
VITE_API_KEY=your-api-key

# Azure Speech SDK credentials
VITE_AZURE_SPEECH_KEY=your-speech-key
VITE_AZURE_SPEECH_REGION=eastus

# Power BI — set to "false" to show the recharts fallback
VITE_POWERBI_ENABLED=true
```

## Features

| Feature | Description |
|---|---|
| **Voice input** | Dictate blood requests via Azure Speech SDK with live transcript preview |
| **Request form** | Blood type selector, component picker, unit count, urgency radio (CRITICAL pulses red) |
| **Broadcast status** | Real-time polling every 3 s — banks show animated status dots as replies arrive |
| **Confirmation card** | Bank name, address, click-to-call phone, Azure Maps thumbnail |
| **Fallback donors** | In-hospital donor table with eligibility, ETA, click-to-call, mark-contacted toggle |
| **Power BI analytics** | Embedded Power BI report or recharts fallback when disabled |

## Route structure

| Route | Page |
|---|---|
| `/` | Dashboard — stats, recent requests table, analytics |
| `/requests/new` | NewRequest — full-page request form with voice input |
| `/requests/:id` | RequestDetail — broadcast status or confirmation card |
| `/analytics` | Analytics — summary stats + full Power BI panel |

## Tech stack

- **React 18** + **Vite 5** — fast HMR dev experience
- **React Router v6** — client-side routing
- **Zustand** — lightweight request lifecycle state
- **TanStack Query** — server state caching
- **Tailwind CSS v3** — utility-first styling with custom HemoSync brand colours
- **Azure Speech SDK** — browser-based voice recognition
- **powerbi-client-react** — embedded Power BI reports
- **recharts** — fallback analytics charts
