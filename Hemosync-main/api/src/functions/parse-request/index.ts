import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { AzureOpenAI } from "openai";
import { CosmosClient } from "@azure/cosmos";
import { z } from "zod";
import { randomUUID } from "crypto";
import { validateApiKey } from "../../middleware/auth.js";
import { createLogger } from "../../middleware/logger.js";
import { getOpenAIKey, getCosmosKey } from "../../middleware/keyvault.js";
import type { ParseRequestResponse } from "@hemosync/types";

const RequestBodySchema = z.object({
  rawText: z.string().min(1, "rawText is required"),
  interface: z.enum(["TEAMS", "WHATSAPP", "WEB"]),
  coordinatorId: z.string().min(1, "coordinatorId is required"),
  hospitalId: z.string().min(1, "hospitalId is required"),
});

const SYSTEM_PROMPT = `You are a medical blood request parser for an emergency blood coordination system.
Extract the following structured fields from a natural language blood request message:
- bloodType: one of "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-" (or null if not specified)
- component: one of "PRBC", "FFP", "PLATELETS", "CRYOPRECIPITATE", "WHOLE_BLOOD" (or null if not specified)
- units: integer number of units requested (or null if not specified)
- urgency: one of "CRITICAL", "HIGH", "NORMAL" (or null if not clear)
- location: a string describing the location/hospital name (or null if not provided)
- confidence: a float between 0 and 1
- clarifications: an array of strings describing any ambiguities

Respond ONLY with a valid JSON object containing these fields. No additional text.`;

export async function parseRequest(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const requestId = randomUUID();
  const logger = createLogger("parse-request", requestId);
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

  const parsed = RequestBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      status: 400,
      jsonBody: {
        error: parsed.error.errors.map((e: { message: string }) => e.message).join(", "),
        code: "VALIDATION_ERROR",
        requestId,
      },
    };
  }

  const { rawText, interface: channel, coordinatorId, hospitalId } = parsed.data;

  try {
    const [openAIKey, cosmosKey] = await Promise.all([getOpenAIKey(), getCosmosKey()]);

    const openAIEndpoint = process.env["AZURE_OPENAI_ENDPOINT"] ?? "";
    const openAIDeployment = process.env["AZURE_OPENAI_DEPLOYMENT"] ?? "gpt-4o";

    const openAIClient = new AzureOpenAI({
      endpoint: openAIEndpoint,
      apiKey: openAIKey,
      apiVersion: "2024-02-01"
    });

    logger.info("Calling Azure OpenAI GPT-4o for NLP parsing", { rawText: rawText.slice(0, 100) });

    const completion = await openAIClient.chat.completions.create({
      model: openAIDeployment,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: rawText },
      ],
      temperature: 0.1,
      max_tokens: 500
    });

    const rawContent = completion.choices[0]?.message?.content ?? "{}";

    let extracted: {
      bloodType: string | null;
      component: string | null;
      units: number | null;
      urgency: string | null;
      location: string | null;
      confidence: number;
      clarifications: string[];
    };

    try {
      extracted = JSON.parse(rawContent) as typeof extracted;
    } catch {
      throw new Error(`OpenAI returned invalid JSON: ${rawContent.slice(0, 200)}`);
    }

    const ParsedSchema = z.object({
      bloodType: z.string().nullable(),
      component: z.string().nullable(),
      units: z.number().nullable(),
      urgency: z.enum(["CRITICAL", "HIGH", "NORMAL"]).nullable(),
      location: z.string().nullable(),
      confidence: z.number().min(0).max(1),
      clarifications: z.array(z.string()),
    });

    const validatedExtraction = ParsedSchema.parse(extracted);

    const cosmosConnectionString = process.env["COSMOS_CONNECTION_STRING"] ?? "";
    const cosmosClient = new CosmosClient(cosmosConnectionString);
    const container = cosmosClient.database("hemosync").container("requests");

    const requestDoc = {
      id: requestId,
      rawText,
      interface: channel,
      coordinatorId,
      hospitalId,
      bloodType: validatedExtraction.bloodType,
      component: validatedExtraction.component,
      units: validatedExtraction.units,
      urgency: validatedExtraction.urgency,
      location: validatedExtraction.location,
      confidence: validatedExtraction.confidence,
      status: "PENDING",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      broadcasts: [],
    };

    await container.items.create(requestDoc);

    logger.info("Request parsed and saved to Cosmos DB", { requestId, confidence: validatedExtraction.confidence });

    const response: ParseRequestResponse & { requestId: string; location: string | null } = {
      bloodType: (validatedExtraction.bloodType as ParseRequestResponse["bloodType"]) ?? null,
      component: (validatedExtraction.component as ParseRequestResponse["component"]) ?? null,
      units: validatedExtraction.units,
      urgency: (validatedExtraction.urgency as ParseRequestResponse["urgency"]) ?? null,
      confidence: validatedExtraction.confidence,
      clarifications: validatedExtraction.clarifications,
      requestId,
      location: validatedExtraction.location,
    };

    logger.trackRequest(Date.now() - startTime, 200);

    return { status: 200, jsonBody: response };
  } catch (err) {
    logger.error("Failed to parse request", err);
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

app.http("parse-request", {
  methods: ["POST"],
  route: "parse-request",
  authLevel: "anonymous",
  handler: parseRequest,
});