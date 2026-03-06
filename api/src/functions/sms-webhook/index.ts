import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { CosmosClient } from "@azure/cosmos";
import { ServiceBusClient } from "@azure/service-bus";
import { randomUUID } from "crypto";
import { createLogger } from "../../middleware/logger.js";
import { getCosmosKey, getACSKey } from "../../middleware/keyvault.js";
import type { SmsWebhookBody, SmsWebhookResponse } from "@hemosync/types";

type NormalisedReply = "YES" | "NO" | "CHECK";

function normaliseReply(raw: string): { reply: NormalisedReply; units?: number } | null {
  const text = raw.trim().toLowerCase();

  // YES patterns: "yes 2", "yes two units", "y", "yes"
  const yesMatch = text.match(/^(?:yes|y)\s*(\d+)?(?:\s*units?)?$/);
  if (yesMatch) {
    const units = yesMatch[1] ? parseInt(yesMatch[1], 10) : undefined;
    return { reply: "YES", ...(units !== undefined ? { units } : {}) };
  }

  // Word-number YES: "yes two", "yes two units"
  const wordNumbers: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  };
  const yesWordMatch = text.match(/^(?:yes|y)\s+([a-z]+)(?:\s*units?)?$/);
  if (yesWordMatch) {
    const wordNum = wordNumbers[yesWordMatch[1] ?? ""];
    if (wordNum !== undefined) {
      return { reply: "YES", units: wordNum };
    }
  }

  // NO patterns: "no", "n"
  if (/^(?:no|n)$/.test(text)) {
    return { reply: "NO" };
  }

  // CHECK patterns: "check", "?"
  if (/^(?:check|\?)$/.test(text)) {
    return { reply: "CHECK" };
  }

  return null;
}

interface RequestDoc {
  id: string;
  status: string;
  interface: "TEAMS" | "WHATSAPP" | "WEB";
  coordinatorId: string;
  bloodType: string;
  component: string;
  units: number;
  hospitalId: string;
  createdAt: string;
  broadcasts?: Array<{ bankId: string; phone?: string }>;
}

async function findRequestByPhone(
  phone: string,
  cosmosKey: string
): Promise<{ requestId: string | null; bankId: string | null }> {
  const cosmosEndpoint = process.env["COSMOS_DB_ENDPOINT"] ?? "";
  const cosmosClient = new CosmosClient({ endpoint: cosmosEndpoint, key: cosmosKey });
  const container = cosmosClient.database("hemosync").container("requests");

  // Find requests in BROADCASTING status that have this phone in their broadcast list
  // We look at requests created in the last 2 hours to limit scope
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const { resources } = await container.items
    .query({
      query:
        "SELECT * FROM c WHERE c.status = 'BROADCASTING' AND c.createdAt >= @cutoff ORDER BY c.createdAt DESC OFFSET 0 LIMIT 10",
      parameters: [{ name: "@cutoff", value: cutoff }],
    })
    .fetchAll();

  for (const req of resources as RequestDoc[]) {
    if (req.broadcasts) {
      for (const broadcast of req.broadcasts) {
        if (broadcast.phone === phone) {
          return { requestId: req.id, bankId: broadcast.bankId };
        }
      }
    }
  }

  // Fall back to latest BROADCASTING request
  const latest = (resources as RequestDoc[])[0];
  if (latest) {
    return { requestId: latest.id, bankId: null };
  }

  return { requestId: null, bankId: null };
}

export async function smsWebhook(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const webhookId = randomUUID();
  const logger = createLogger("sms-webhook", webhookId);
  const startTime = Date.now();

  let body: SmsWebhookBody;
  try {
    body = (await request.json()) as SmsWebhookBody;
  } catch {
    return {
      status: 400,
      jsonBody: { error: "Invalid JSON body", code: "BAD_REQUEST" },
    };
  }

  if (!body.from || !body.body) {
    return {
      status: 400,
      jsonBody: { error: "Missing required fields: from, body", code: "VALIDATION_ERROR" },
    };
  }

  const normalisedReply = normaliseReply(body.body);
  if (!normalisedReply) {
    logger.warn("Unrecognised reply format", { from: body.from, raw: body.body });
    const response: SmsWebhookResponse = {
      processed: false,
      requestId: null,
      bankId: null,
      normalisedReply: null,
    };
    return { status: 200, jsonBody: response };
  }

  try {
    const cosmosKey = await getCosmosKey();
    const { requestId, bankId } = await findRequestByPhone(body.from, cosmosKey);

    if (!requestId) {
      logger.warn("No matching request found for sender", { from: body.from });
      const response: SmsWebhookResponse = {
        processed: false,
        requestId: null,
        bankId: null,
        normalisedReply: normalisedReply.reply,
      };
      return { status: 200, jsonBody: response };
    }

    const cosmosEndpoint = process.env["COSMOS_DB_ENDPOINT"] ?? "";
    const cosmosClient = new CosmosClient({ endpoint: cosmosEndpoint, key: cosmosKey });
    const container = cosmosClient.database("hemosync").container("requests");

    // Update request status based on reply
    if (normalisedReply.reply === "YES") {
      await container.item(requestId, requestId).patch([
        { op: "replace", path: "/status", value: "CONFIRMED" },
        { op: "replace", path: "/updatedAt", value: new Date().toISOString() },
      ]);

      // Publish to Service Bus confirmations queue
      const serviceBusConnStr = process.env["SERVICE_BUS_CONNECTION_STRING"] ?? "";
      if (serviceBusConnStr) {
        const sbClient = new ServiceBusClient(serviceBusConnStr);
        const sender = sbClient.createSender("confirmations");
        try {
          await sender.sendMessages({
            body: {
              requestId,
              bankId,
              phone: body.from,
              units: normalisedReply.units,
              confirmedAt: new Date().toISOString(),
            },
            contentType: "application/json",
          });
        } finally {
          await sender.close();
          await sbClient.close();
        }
      }

      // Notify coordinator via ACS based on interface
      const { resource: requestDoc } = await container.item(requestId, requestId).read<RequestDoc>();
      if (requestDoc) {
        await notifyCoordinator(requestDoc, body.from, normalisedReply.units, cosmosKey);
      }
    }

    logger.info("SMS webhook processed", {
      requestId,
      bankId,
      reply: normalisedReply.reply,
      units: normalisedReply.units,
    });
    logger.trackRequest(Date.now() - startTime, 200);

    const response: SmsWebhookResponse = {
      processed: true,
      requestId,
      bankId,
      normalisedReply: normalisedReply.reply,
    };
    return { status: 200, jsonBody: response };
  } catch (err) {
    logger.error("SMS webhook processing failed", err);
    return {
      status: 500,
      jsonBody: {
        error: err instanceof Error ? err.message : "Internal server error",
        code: "INTERNAL_ERROR",
      },
    };
  }
}

async function notifyCoordinator(
  requestDoc: RequestDoc,
  bankPhone: string,
  units: number | undefined,
  _cosmosKey: string
): Promise<void> {
  // Notification is channel-specific; ACS SMS/email for WEB/WHATSAPP, Teams webhook for TEAMS
  const message = `Blood request ${requestDoc.id} CONFIRMED. Bank ${bankPhone} will supply ${units ?? requestDoc.units} units of ${requestDoc.bloodType} ${requestDoc.component}.`;

  if (requestDoc.interface === "WEB" || requestDoc.interface === "WHATSAPP") {
    const acsConnStr = await getACSKey();
    const { SmsClient } = await import("@azure/communication-sms");
    const smsClient = new SmsClient(acsConnStr);
    // In production, look up coordinator phone from DB
    const coordinatorPhone = process.env["COORDINATOR_FALLBACK_PHONE"] ?? "";
    if (coordinatorPhone) {
      await smsClient.send({
        from: process.env["ACS_PHONE_NUMBER"] ?? "",
        to: [coordinatorPhone],
        message,
      });
    }
  }
  // TEAMS: would call Teams webhook or Bot Framework; omitted for brevity
}

app.http("sms-webhook", {
  methods: ["POST"],
  route: "sms-webhook",
  authLevel: "anonymous",
  handler: smsWebhook,
});
