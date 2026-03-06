# HemoSync API Reference

All endpoints are deployed as Azure Functions v4 and exposed through Azure API Management.

**Base URL (production):** `https://<apim-name>.azure-api.net/api`
**Base URL (local dev):** `http://localhost:7071/api`

**Authentication:** All endpoints require `x-api-key` header (APIM subscription key).

---

## Endpoints

- [POST /parse-request](#post-parse-request)
- [POST /ranked-banks](#post-ranked-banks)
- [POST /broadcast](#post-broadcast)
- [POST /sms-webhook](#post-sms-webhook)
- [POST /fallback-donors](#post-fallback-donors)
- [GET /embed-token](#get-embed-token)
- [POST /speech-to-text](#post-speech-to-text)

---

## POST /parse-request

Parses a natural language blood request using Azure OpenAI (GPT-4o) and returns structured data.

### Request Headers

| Header | Value | Required |
|---|---|---|
| `x-api-key` | APIM subscription key | Yes |
| `Content-Type` | `application/json` | Yes |

### Request Body

```json
{
  "text": "string",        // Natural language request text
  "interface": "string",   // TEAMS | WHATSAPP | WEB
  "coordinatorId": "string",
  "hospitalId": "string"
}
```

### Response Body

```json
{
  "requestId": "string",
  "bloodType": "string",    // O+, A+, B+, AB+, O-, A-, B-, AB-
  "units": "number",
  "urgency": "string",      // CRITICAL | HIGH | STANDARD
  "hospitalId": "string",
  "hospitalName": "string",
  "coordinatorId": "string",
  "interface": "string",
  "parsedAt": "string"      // ISO 8601 timestamp
}
```

### Example

```bash
curl -X POST http://localhost:7071/api/parse-request \
  -H "x-api-key: your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Need 2 units O+ blood urgently at AIIMS New Delhi",
    "interface": "WEB",
    "coordinatorId": "coord_001",
    "hospitalId": "hosp_001"
  }'
```

### Error Responses

| Status | Shape |
|---|---|
| `400` | `{ "error": "Invalid request body", "details": "string" }` |
| `401` | `{ "error": "Unauthorized" }` |
| `500` | `{ "error": "Parse failed", "message": "string" }` |

---

## POST /ranked-banks

Scores and ranks blood banks by distance, reliability, and cached stock. Returns top 5.

### Request Headers

| Header | Value | Required |
|---|---|---|
| `x-api-key` | APIM subscription key | Yes |
| `Content-Type` | `application/json` | Yes |

### Request Body

```json
{
  "requestId": "string",
  "bloodType": "string",
  "units": "number",
  "hospitalId": "string",
  "location": {
    "lat": "number",
    "lng": "number"
  }
}
```

### Response Body

```json
{
  "requestId": "string",
  "rankedBanks": [
    {
      "bankId": "string",
      "name": "string",
      "phone": "string",
      "address": "string",
      "distanceKm": "number",
      "etaMinutes": "number",
      "reliabilityScore": "number",
      "compositeScore": "number",
      "rank": "number"
    }
  ],
  "rankedAt": "string"
}
```

### Example

```bash
curl -X POST http://localhost:7071/api/ranked-banks \
  -H "x-api-key: your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "req_abc123",
    "bloodType": "O+",
    "units": 2,
    "hospitalId": "hosp_001",
    "location": { "lat": 28.5672, "lng": 77.2100 }
  }'
```

### Error Responses

| Status | Shape |
|---|---|
| `400` | `{ "error": "Invalid request body", "details": "string" }` |
| `401` | `{ "error": "Unauthorized" }` |
| `500` | `{ "error": "Ranking failed", "message": "string" }` |

---

## POST /broadcast

Sends simultaneous SMS to top-ranked blood banks via MSG91. Enqueues job to Service Bus.

### Request Headers

| Header | Value | Required |
|---|---|---|
| `x-api-key` | APIM subscription key | Yes |
| `Content-Type` | `application/json` | Yes |

### Request Body

```json
{
  "requestId": "string",
  "bloodType": "string",
  "units": "number",
  "hospitalName": "string",
  "banks": [
    {
      "bankId": "string",
      "name": "string",
      "phone": "string"
    }
  ]
}
```

### Response Body

```json
{
  "requestId": "string",
  "status": "BROADCAST_SENT",
  "sentTo": ["string"],    // Array of bank IDs
  "sentAt": "string"
}
```

### Example

```bash
curl -X POST http://localhost:7071/api/broadcast \
  -H "x-api-key: your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "req_abc123",
    "bloodType": "O+",
    "units": 2,
    "hospitalName": "AIIMS New Delhi",
    "banks": [
      { "bankId": "bb_002", "name": "AIIMS Blood Bank", "phone": "+911126588500" }
    ]
  }'
```

### Error Responses

| Status | Shape |
|---|---|
| `400` | `{ "error": "Invalid request body", "details": "string" }` |
| `401` | `{ "error": "Unauthorized" }` |
| `500` | `{ "error": "Broadcast failed", "message": "string" }` |

---

## POST /sms-webhook

Receives inbound SMS replies (YES/NO) from blood banks via MSG91 webhook. Updates request status.

### Request Headers

| Header | Value | Required |
|---|---|---|
| `x-api-key` | APIM subscription key | Yes |
| `Content-Type` | `application/json` | Yes |

### Request Body

```json
{
  "from": "string",        // Sender phone number
  "to": "string",          // HemoSync number
  "message": "string",     // YES or NO (case-insensitive)
  "requestId": "string"
}
```

### Response Body

```json
{
  "requestId": "string",
  "bankId": "string",
  "status": "CONFIRMED | DECLINED",
  "processedAt": "string"
}
```

### Example

```bash
curl -X POST http://localhost:7071/api/sms-webhook \
  -H "x-api-key: your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "+911126588500",
    "to": "+911800HMSYNC",
    "message": "YES",
    "requestId": "req_abc123"
  }'
```

### Error Responses

| Status | Shape |
|---|---|
| `400` | `{ "error": "Invalid webhook payload", "details": "string" }` |
| `401` | `{ "error": "Unauthorized" }` |
| `500` | `{ "error": "Webhook processing failed", "message": "string" }` |

---

## POST /fallback-donors

Queries Azure API for FHIR to find eligible in-hospital donors when no bank responds. Returns donors sorted by ETA.

### Request Headers

| Header | Value | Required |
|---|---|---|
| `x-api-key` | APIM subscription key | Yes |
| `Content-Type` | `application/json` | Yes |

### Request Body

```json
{
  "requestId": "string",
  "bloodType": "string",
  "units": "number",
  "hospitalId": "string",
  "location": {
    "lat": "number",
    "lng": "number"
  }
}
```

### Response Body

```json
{
  "requestId": "string",
  "donors": [
    {
      "donorId": "string",
      "fhirPatientId": "string",
      "bloodType": "string",
      "etaMinutes": "number",
      "lastDonationDate": "string",
      "isEligible": "boolean"
    }
  ],
  "queriedAt": "string"
}
```

### Example

```bash
curl -X POST http://localhost:7071/api/fallback-donors \
  -H "x-api-key: your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "req_abc123",
    "bloodType": "O+",
    "units": 2,
    "hospitalId": "hosp_001",
    "location": { "lat": 28.5672, "lng": 77.2100 }
  }'
```

### Error Responses

| Status | Shape |
|---|---|
| `400` | `{ "error": "Invalid request body", "details": "string" }` |
| `401` | `{ "error": "Unauthorized" }` |
| `500` | `{ "error": "FHIR query failed", "message": "string" }` |

---

## GET /embed-token

Generates a Power BI Embedded access token for the analytics dashboard.

### Request Headers

| Header | Value | Required |
|---|---|---|
| `x-api-key` | APIM subscription key | Yes |

### Query Parameters

| Parameter | Description | Required |
|---|---|---|
| `reportId` | Power BI report ID | No (uses env default) |

### Response Body

```json
{
  "token": "string",
  "tokenId": "string",
  "expiration": "string"   // ISO 8601 timestamp
}
```

### Example

```bash
curl http://localhost:7071/api/embed-token \
  -H "x-api-key: your-key"
```

### Error Responses

| Status | Shape |
|---|---|
| `401` | `{ "error": "Unauthorized" }` |
| `500` | `{ "error": "Token generation failed", "message": "string" }` |

---

## POST /speech-to-text

Generates a short-lived Azure AI Speech token for client-side speech recognition.

### Request Headers

| Header | Value | Required |
|---|---|---|
| `x-api-key` | APIM subscription key | Yes |
| `Content-Type` | `application/json` | Yes |

### Request Body

```json
{
  "region": "string"    // Optional; defaults to AZURE_SPEECH_REGION env var
}
```

### Response Body

```json
{
  "token": "string",
  "region": "string",
  "expiresAt": "string"  // ISO 8601 timestamp (10 minutes from issue)
}
```

### Example

```bash
curl -X POST http://localhost:7071/api/speech-to-text \
  -H "x-api-key: your-key" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Error Responses

| Status | Shape |
|---|---|
| `401` | `{ "error": "Unauthorized" }` |
| `500` | `{ "error": "Speech token generation failed", "message": "string" }` |
