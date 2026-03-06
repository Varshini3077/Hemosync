# @hemosync/whatsapp-handler

Azure App Service Express application that receives inbound WhatsApp messages from hospital coordinators via Azure Communication Services (ACS) and routes outbound confirmations back.

## Architecture

```
Coordinator's WhatsApp
        │
        ▼
Azure Communication Services (ACS)
        │  POST /webhook/whatsapp
        ▼
whatsapp-handler (Express :3000)
        │
        ├─ messageParser.ts    regex → ParsedMessage (+ GPT-4o fallback)
        │
        ├─ POST /api/parse-request  →  HemoSync API
        │
        └─ POST /send              ←  sms-webhook Azure Function
                │
                ▼
        ACS NotificationMessagesClient
                │
                ▼
        Coordinator's WhatsApp (confirmation)
```

## Prerequisites

- Node.js >= 20
- pnpm >= 8
- Azure Communication Services resource with WhatsApp Business channel
- HemoSync API deployed or running locally

## Local Development

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```env
PORT=3000
ACS_CONNECTION_STRING=<your-acs-connection-string>
ACS_WHATSAPP_CHANNEL_ID=<your-whatsapp-channel-registration-id>
HEMOSYNC_API_URL=http://localhost:7071/api
WHATSAPP_HANDLER_URL=http://localhost:3000
```

### 3. Start locally

```bash
pnpm dev
```

### 4. Expose via ngrok for ACS webhook

```bash
ngrok http 3000
```

Copy the HTTPS URL (e.g. `https://abc123.ngrok.io`).

## ACS WhatsApp Business Setup

### Register a WhatsApp Business Account

1. Go to [Azure Portal](https://portal.azure.com) → **Azure Communication Services** resource
2. Under **Channels → WhatsApp**, connect your WhatsApp Business Account
3. Note the **Channel Registration ID** — this is `ACS_WHATSAPP_CHANNEL_ID`

### Register the Webhook URL

1. In the ACS resource, go to **Events → Event Grid**
2. Create a new event subscription:
   - **Event type**: `Microsoft.Communication.AdvancedMessageReceived`
   - **Endpoint type**: Webhook
   - **Endpoint URL**: `https://<your-ngrok-url>/webhook/whatsapp`
3. Validate the subscription — ACS will send a GET request with `?validationToken=...`

### Message Templates

The confirmation template must be pre-approved in WhatsApp Business Manager:

**Template name**: `hemosync_blood_confirmation`
**Language**: `en_US`
**Body**: `✅ Blood confirmed: {{1}} units {{2}} at {{3}}. Call: {{4}}. Req: {{5}}`

Map template variables:
- `{{1}}` → units
- `{{2}}` → bloodType
- `{{3}}` → bankName
- `{{4}}` → phone
- `{{5}}` → requestId

## API Routes

### `GET /webhook/whatsapp`

ACS webhook validation. Echoes back the `validationToken` query parameter.

### `POST /webhook/whatsapp`

Receives inbound ACS `AdvancedMessageReceived` events. Returns 200 immediately; processes asynchronously.

**Request body** (ACS event array):
```json
[
  {
    "eventType": "Microsoft.Communication.AdvancedMessageReceived",
    "data": {
      "from": "+447700900000",
      "message": { "content": "Need 2 units O+ urgently" },
      "receivedTimestamp": "2024-01-15T10:30:00Z"
    }
  }
]
```

### `POST /send`

Internal route called by the sms-webhook Azure Function to send a confirmation WhatsApp back to the coordinator.

**Request body**:
```json
{
  "to": "+447700900000",
  "units": 2,
  "bloodType": "O+",
  "bankName": "City Blood Bank",
  "phone": "+447700900123",
  "requestId": "req-abc123"
}
```

**Response**:
```json
{ "sent": true, "to": "+447700900000" }
```

### `GET /health`

Health check endpoint.

## Message Parsing

`messageParser.ts` uses regex patterns to extract structured data from free-text coordinator messages. If confidence is below 0.6, the raw message is forwarded to `POST /api/parse-request` for GPT-4o parsing.

**Examples**:

| Input | Parsed |
|-------|--------|
| `Need 2 units O+ blood urgently` | `{ bloodType: 'O+', units: 2, urgency: 'HIGH' }` |
| `CRITICAL — 4 units AB- FFP stat` | `{ bloodType: 'AB-', units: 4, component: 'FFP', urgency: 'CRITICAL' }` |
| `platelets 1 bag for ward 7B` | `{ component: 'PLATELETS', units: 1, hospitalId: '7B' }` |

## Deployment to Azure App Service

### Build

```bash
pnpm build
```

### Deploy via Azure CLI

```bash
az webapp up \
  --name hemosync-whatsapp-handler \
  --resource-group <rg-name> \
  --runtime "NODE:20-lts" \
  --sku B1
```

### Set environment variables

```bash
az webapp config appsettings set \
  --name hemosync-whatsapp-handler \
  --resource-group <rg-name> \
  --settings \
    ACS_CONNECTION_STRING="<value>" \
    ACS_WHATSAPP_CHANNEL_ID="<value>" \
    HEMOSYNC_API_URL="<value>"
```

Update the ACS webhook URL to your App Service URL after deployment.
