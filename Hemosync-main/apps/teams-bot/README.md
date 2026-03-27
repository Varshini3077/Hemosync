# @hemosync/teams-bot

Azure Bot Service application for HemoSync — enables hospital coordinators to submit emergency blood requests directly from Microsoft Teams.

## Architecture

```
Teams Client
    │
    ▼
Bot Framework Adapter (restify :3978)
    │
    ▼
HemoSyncBot (TeamsActivityHandler)
    │
    ├─ graphEnrichmentMiddleware  →  Microsoft Graph (user profile)
    │
    ├─ RequestDialog (waterfall)
    │    ├─ requestCard     (Adaptive Card — form)
    │    ├─ parse-request   (API)
    │    ├─ ranked-banks    (API)
    │    ├─ broadcast       (API)
    │    ├─ resultsCard     (Adaptive Card — status)
    │    └─ StatusPoller    (polls /api/requests/:id/status)
    │         ├─ confirmationCard  (on CONFIRMED)
    │         └─ donorCard         (on FAILED/timeout)
    │
    └─ Adaptive Cards
         ├─ welcomeCard
         ├─ requestCard
         ├─ resultsCard
         ├─ confirmationCard
         └─ donorCard
```

## Prerequisites

- Node.js >= 20
- pnpm >= 8
- Azure Bot Service registration (App ID + Password)
- Microsoft Graph permissions: `User.Read` (delegated)
- HemoSync API deployed or running locally

## Local Development

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

Copy `.env.example` and fill in your values:

```bash
cp ../../.env.example .env
```

Required variables:

```env
MicrosoftAppId=<your-bot-app-id>
MicrosoftAppPassword=<your-bot-app-password>
HEMOSYNC_API_URL=http://localhost:7071/api
PORT=3978
```

### 3. Start the bot locally

```bash
pnpm dev
```

### 4. Test with Bot Framework Emulator

1. Download [Bot Framework Emulator](https://github.com/microsoft/BotFramework-Emulator/releases)
2. Open the emulator and connect to: `http://localhost:3978/api/messages`
3. Enter your `MicrosoftAppId` and `MicrosoftAppPassword` if configured

### 5. Expose locally via ngrok

For Teams testing, expose your local port with ngrok:

```bash
ngrok http 3978
```

Copy the HTTPS forwarding URL (e.g. `https://abc123.ngrok.io`).

## Teams Webhook Registration

1. Go to [Azure Portal](https://portal.azure.com) → **Azure Bot** resource
2. Under **Settings → Configuration**, set the **Messaging endpoint** to:
   ```
   https://<your-ngrok-url>/api/messages
   ```
3. Save and wait for validation.

## Registering the Bot in Teams Admin Center

1. Package the Teams app manifest:
   ```bash
   cd manifest && zip -r ../hemosync-teams.zip .
   ```
2. Go to [Teams Admin Center](https://admin.teams.microsoft.com)
3. Navigate to **Teams apps → Manage apps → Upload**
4. Upload `hemosync-teams.zip`
5. Enable the app for your organisation or specific users

## Deployment to Azure Bot Service

### Build

```bash
pnpm build
```

### Deploy via Azure CLI

```bash
az webapp deploy \
  --resource-group <rg-name> \
  --name <app-service-name> \
  --src-path dist \
  --type zip
```

### Recommended Azure resources

| Resource | Purpose |
|----------|---------|
| Azure Bot Service | Bot registration and channel routing |
| Azure App Service (Node 20) | Hosts the restify server |
| Azure Key Vault | Stores `MicrosoftAppPassword` and API keys |
| Azure Active Directory | Bot app registration |

## Adaptive Cards

All cards target Adaptive Cards schema **1.5**. Cards are defined in `src/cards/`:

| File | Description |
|------|-------------|
| `welcomeCard.ts` | Shown when a new member joins |
| `requestCard.ts` | Blood request form (blood type, component, units, urgency, location) |
| `resultsCard.ts` | Ranked bank list with broadcast status indicator |
| `confirmationCard.ts` | Confirmation with click-to-call button |
| `donorCard.ts` | In-hospital donor fallback list |

## Graph Enrichment

The `graphEnrichmentMiddleware` fetches the calling user's `displayName`, `department`, and `officeLocation` on every turn via Microsoft Graph. The `department` field is used to pre-fill the `hospitalId` on blood requests and the `officeLocation` pre-fills the location field on the request form.

SSO token is expected in `activity.channelData.ssoToken` (Teams SSO) or `activity.value.token`.
