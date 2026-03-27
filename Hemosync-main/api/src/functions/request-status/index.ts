import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { CosmosClient } from "@azure/cosmos";
import { validateApiKey } from "../../middleware/auth.js";
import { createLogger } from "../../middleware/logger.js";
import { randomUUID } from "crypto";

export async function getRequestStatus(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const requestId = (request.params["requestId"] as string) ?? randomUUID();
  const logger = createLogger("request-status", requestId);

  const authError = validateApiKey(request);
  if (authError) return authError;

  if (!requestId) {
    return {
      status: 400,
      jsonBody: { error: "requestId is required", code: "BAD_REQUEST" },
    };
  }

  try {
    const cosmosConnectionString = process.env["COSMOS_CONNECTION_STRING"] ?? "";
    const cosmosClient = new CosmosClient(cosmosConnectionString);
    const container = cosmosClient
      .database(process.env["COSMOS_DATABASE_NAME"] ?? "hemosync")
      .container(process.env["COSMOS_REQUESTS_CONTAINER"] ?? "requests");

    const { resource: doc } = await container.item(requestId, requestId).read();

    if (!doc) {
      return {
        status: 404,
        jsonBody: { error: "Request not found", code: "NOT_FOUND", requestId },
      };
    }

    const broadcasts: Array<{
      bankId: string;
      bankName: string;
      success: boolean;
      messageId?: string;
      error?: string;
      sentAt: string;
    }> = Array.isArray(doc.broadcasts) ? doc.broadcasts.flat() : [];

    const banks = broadcasts.map((b) => ({
      bankId: b.bankId,
      bankName: b.bankName,
      reply: b.success ? ("PENDING" as const) : ("TIMEOUT" as const),
    }));

    logger.info("Request status fetched", { requestId, status: doc.status });

    return {
      status: 200,
      jsonBody: {
        id: doc.id,
        status: doc.status ?? "PENDING",
        banks,
        broadcastStartedAt: doc.updatedAt,
        confirmedBank: doc.confirmedBank ?? null,
      },
    };
  } catch (err) {
    logger.error("Failed to fetch request status", err);
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

app.http("request-status", {
  methods: ["GET"],
  route: "requests/{requestId}/status",
  authLevel: "anonymous",
  handler: getRequestStatus,
});
