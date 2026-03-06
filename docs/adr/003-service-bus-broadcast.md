# ADR 003 — Azure Service Bus Trigger for Broadcast Function

**Date:** 2024-11-15
**Status:** Accepted

---

## Context

After `ranked-banks` selects the top 5 blood banks, the broadcast step must send simultaneous SMS messages to all 5 and wait for the first YES reply. The question is how `ranked-banks` should hand off to the broadcast function:

**Option A — Direct HTTP call from ranked-banks to broadcast:**
- Simple to implement
- Synchronous: if broadcast is slow or fails, the ranked-banks response is delayed
- No retry: if broadcast function crashes mid-send, the partial send is unrecoverable
- Creates tight coupling between two functions with different SLAs
- Not observable: no visibility into the queue depth or processing lag

**Option B — Service Bus queue (enqueue then trigger):**
- `ranked-banks` enqueues a `BroadcastJob` message and returns immediately to the coordinator
- `broadcast` function is a Service Bus trigger; Azure Functions runtime dequeues and retries automatically
- Dead-letter queue captures failed jobs for manual review
- Queue depth is visible in Azure Monitor; alerts can fire if jobs pile up
- Functions can be scaled independently

---

## Decision

`ranked-banks` enqueues a `BroadcastJob` to Azure Service Bus and responds with `{ status: "QUEUED", requestId }`. The `broadcast` function is a Service Bus trigger (`serviceBusTrigger` binding) that dequeues, sends SMS via MSG91, and updates the request status in Cosmos DB.

The `BroadcastJob` message schema:

```json
{
  "requestId": "string",
  "bloodType": "string",
  "units": "number",
  "hospitalName": "string",
  "banks": [{ "bankId": "string", "name": "string", "phone": "string" }]
}
```

Service Bus is configured with:
- `maxDeliveryCount: 5` (5 retry attempts before dead-lettering)
- `lockDuration: PT2M` (2-minute processing window per message)
- Dead-letter queue monitored by Application Insights alert

---

## Consequences

**Positive:**
- Async: coordinator sees an immediate response; broadcast happens in the background
- Retryable: Azure Functions retries failed broadcasts up to 5 times automatically
- Observable: queue depth and dead-letter count are first-class Azure Monitor metrics
- Decoupled: ranked-banks and broadcast can be deployed, scaled, and versioned independently
- Honest to the architecture diagram: the Service Bus arrow in the diagram has real semantic meaning

**Negative:**
- Broadcast is now asynchronous; coordinator does not get a synchronous "SMS sent" confirmation
- Added infra component (Service Bus namespace)
- Local dev requires either the Service Bus emulator or Azurite with a Service Bus shim (current workaround: use a local HTTP trigger for dev; see `docs/local-development.md`)
