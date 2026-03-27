import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
  ServiceBusQueueTriggerOptions,
} from "@azure/functions";
import { CosmosClient } from "@azure/cosmos";
import axios from "axios";
import { z } from "zod";
import { randomUUID } from "crypto";
import { validateApiKey } from "../../middleware/auth.js";
import { createLogger } from "../../middleware/logger.js";
import { getCosmosKey, getMsg91Key } from "../../middleware/keyvault.js";
import type { BroadcastJob } from "@hemosync/types";

const MSG91_API_URL = "https://api.msg91.com/api/v5/flow/";

const BroadcastBodySchema = z.object({
  requestId: z.string().min(1),
  bloodType: z.string().min(1),
  component: z.string().min(1),
  units: z.number().positive(),
  banks: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      phone: z.string(),
    })
  ),
});

function buildSmsText(
  units: number,
  bloodType: string,
  component: string,
  requestId: string
): string {
  return `HEMOSYNC ALERT: Need ${units} units ${bloodType} ${component}. Reply: YES ${units} / NO / CHECK. Req ID: ${requestId}`;
}

async function sendSms(
  phone: string,
  message: string,
  authKey: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await axios.post(
      MSG91_API_URL,
      {
        template_id: process.env["MSG91_TEMPLATE_ID"] ?? "",
        recipients: [{ mobiles: phone, message }],
      },
      {
        headers: {
          authkey: authKey,
          "Content-Type": "application/JSON",
        },
        timeout: 10000,
      }
    );
const msgId = (response.data as { request_id?: string }).request_id;
    return { success: true, ...(msgId !== undefined && { messageId: msgId }) };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "SMS send failed",
    };
  }
}
  
export async function processBroadcastJob(job: BroadcastJob, context: InvocationContext): Promise<void> {
  const logger = createLogger("broadcast-service-bus", job.requestId);

  try {
    const [cosmosKey, msg91Key] = await Promise.all([getCosmosKey(), getMsg91Key()]);

    const cosmosEndpoint = process.env["COSMOS_DB_ENDPOINT"] ?? "";
    const cosmosClient = new CosmosClient({ endpoint: cosmosEndpoint, key: cosmosKey });
    const container = cosmosClient.database("hemosync").container("requests");

    const smsResults = await Promise.allSettled(
      job.banks.map(async (bank) => {
        const result = await sendSms(bank.phone, job.message, msg91Key);
        return { bankId: bank.id, bankName: bank.name, ...result };
      })
    );

    const broadcastLog = smsResults.map((r, i) => {
      const bank = job.banks[i];
      if (r.status === "fulfilled") {
        return {
          bankId: bank?.id ?? "",
          bankName: bank?.name ?? "",
          sentAt: new Date().toISOString(),
          success: r.value.success,
          messageId: r.value.messageId,
          error: r.value.error,
        };
      }
      return {
        bankId: bank?.id ?? "",
        bankName: bank?.name ?? "",
        sentAt: new Date().toISOString(),
        success: false,
        error: r.reason instanceof Error ? r.reason.message : "Unknown error",
      };
    });

    const { resource: existing } = await container.item(job.requestId, job.requestId).read();
    if (existing) {
      const currentBroadcasts = (existing as { broadcasts?: unknown[] }).broadcasts ?? [];
      await container.item(job.requestId, job.requestId).patch([
        {
          op: "add",
          path: "/broadcasts/-",
          value: broadcastLog,
        },
        {
          op: "replace",
          path: "/status",
          value: "BROADCASTING",
        },
        {
          op: "replace",
          path: "/updatedAt",
          value: new Date().toISOString(),
        },
      ]);
    }

    const successCount = broadcastLog.filter((r) => r.success).length;
    logger.info("Broadcast job processed", {
      requestId: job.requestId,
      totalBanks: job.banks.length,
      successCount,
    });
  } catch (err) {
    logger.error("Failed to process broadcast job", err);
    throw err;
  }
}

// HTTP trigger for direct invocation during demo/testing
export async function broadcastHttp(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const requestId = randomUUID();
  const logger = createLogger("broadcast-http", requestId);
  const startTime = Date.now();

  const authError = validateApiKey(request);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      status: 400,
      jsonBody: { error: "Invalid JSON body", code: "BAD_REQUEST", requestId },
    };
  }

  const parsed = BroadcastBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      status: 400,
      jsonBody: {
        error: parsed.error.errors.map((e) => e.message).join(", "),
        code: "VALIDATION_ERROR",
        requestId,
      },
    };
  }

  const { requestId: reqId, bloodType, component, units, banks } = parsed.data;

  try {
    const msg91Key = await getMsg91Key();
    const message = buildSmsText(units, bloodType, component, reqId);

    const smsResults = await Promise.allSettled(
      banks.map(async (bank) => {
        const result = await sendSms(bank.phone, message, msg91Key);
        return { bankId: bank.id, bankName: bank.name, ...result };
      })
    );

    const results = smsResults.map((r, i) => {
      const bank = banks[i];
      if (r.status === "fulfilled") {
          return { ...r.value, bankId: bank?.id ?? "", bankName: bank?.name ?? "" };
}
return {
  bankId: bank?.id ?? "",
  bankName: bank?.name ?? "",
  success: false,
  error: r.reason instanceof Error ? r.reason.message : "Unknown error",
};
    });

    // Log to Cosmos DB
    const cosmosKey = await getCosmosKey();
    const cosmosEndpoint = process.env["COSMOS_DB_ENDPOINT"] ?? "";
    const cosmosClient = new CosmosClient({ endpoint: cosmosEndpoint, key: cosmosKey });
    const container = cosmosClient.database("hemosync").container("requests");

    try {
      await container.item(reqId, reqId).patch([
        { op: "add", path: "/broadcasts/-", value: results },
        { op: "replace", path: "/status", value: "BROADCASTING" },
        { op: "replace", path: "/updatedAt", value: new Date().toISOString() },
      ]);
    } catch {
      logger.warn("Could not update request document in Cosmos DB", { reqId });
    }

    const successCount = results.filter((r) => r.success).length;
    logger.info("Broadcast HTTP completed", { reqId, totalBanks: banks.length, successCount });
    logger.trackRequest(Date.now() - startTime, 200);

    return {
      status: 200,
      jsonBody: {
        requestId: reqId,
        broadcastId: randomUUID(),
        totalBanks: banks.length,
        successCount,
        results,
      },
    };
  } catch (err) {
    logger.error("Broadcast HTTP failed", err);
    return {
      status: 500,
      jsonBody: {
        error: err instanceof Error ? err.message : "Internal server error",
        code: "INTERNAL_ERROR",
        requestId,
      },
    };
  }
}

// Service Bus trigger
app.serviceBusQueue("broadcast-service-bus", {
  connection: "SERVICE_BUS_CONNECTION_STRING",
  queueName: "broadcast-jobs",
  handler: processBroadcastJob,
} as ServiceBusQueueTriggerOptions & { handler: typeof processBroadcastJob });

// HTTP trigger for demo/testing
app.http("broadcast", {
  methods: ["POST"],
  route: "broadcast",
  authLevel: "anonymous",
  handler: broadcastHttp,
});
