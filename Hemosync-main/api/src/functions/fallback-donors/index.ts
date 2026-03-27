import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { AzureOpenAI } from "openai";
import axios from "axios";
import { z } from "zod";
import { randomUUID } from "crypto";
import { validateApiKey } from "../../middleware/auth.js";
import { createLogger } from "../../middleware/logger.js";
import { getOpenAIKey } from "../../middleware/keyvault.js";
import type { FallbackDonorsResponse, DonorScore } from "@hemosync/types";

const RequestBodySchema = z.object({
  requestId: z.string().min(1),
  bloodType: z.string().min(1),
  hospitalId: z.string().min(1),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional(),
  radiusKm: z.number().positive().optional(),
  limit: z.number().int().positive().max(20).optional(),
});

interface FHIRPatientRaw {
  resourceType: string;
  id: string;
  extension?: Array<{ url: string; valueString?: string; valueDecimal?: number }>;
  telecom?: Array<{ system: string; value: string }>;
  address?: Array<{
    extension?: Array<{
      extension?: Array<{ url: string; valueDecimal?: number }>;
    }>;
  }>;
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function queryFHIRPatients(bloodType: string): Promise<FHIRPatientRaw[]> {
  const fhirEndpoint = process.env["FHIR_ENDPOINT"] ?? "";
  if (!fhirEndpoint) return [];

  const response = await axios.get<{ entry?: Array<{ resource: FHIRPatientRaw }> }>(
    `${fhirEndpoint}/Patient`,
    {
      params: { bloodType },
      headers: {
        Authorization: `Bearer ${process.env["FHIR_TOKEN"] ?? ""}`,
        Accept: "application/fhir+json",
      },
      timeout: 15000,
    }
  );
  return (response.data.entry ?? []).map((e) => e.resource);
}

function extractExtension(patient: FHIRPatientRaw, url: string): string | number | undefined {
  const ext = patient.extension?.find((e) => e.url.includes(url));
  return ext?.valueString ?? ext?.valueDecimal;
}

function extractPhone(patient: FHIRPatientRaw): string {
  const phone = patient.telecom?.find((t) => t.system === "phone");
  return phone?.value ?? "";
}

function extractCoordinates(patient: FHIRPatientRaw): { lat: number; lng: number } | null {
  const addressExt = patient.address?.[0]?.extension?.[0]?.extension;
  if (!addressExt) return null;
  const lat = addressExt.find((e) => e.url === "latitude")?.valueDecimal;
  const lng = addressExt.find((e) => e.url === "longitude")?.valueDecimal;
  if (lat === undefined || lng === undefined) return null;
  return { lat, lng };
}

interface DonorEligibility {
  isEligible: boolean;
  reason: string;
  score: number;
}

async function scoreWithOpenAI(
  patient: FHIRPatientRaw,
  bloodType: string,
  openAIKey: string
): Promise<DonorEligibility> {
  const lastDonationDate = extractExtension(patient, "last-donation-date") as string | undefined;
  const weightKg = extractExtension(patient, "weight") as number | undefined;
  const patientBloodType = extractExtension(patient, "blood-type") as string | undefined;

  const now = new Date();
  const lastDonation = lastDonationDate ? new Date(lastDonationDate) : null;
  const daysSinceLastDonation = lastDonation
    ? Math.floor((now.getTime() - lastDonation.getTime()) / (24 * 60 * 60 * 1000))
    : 999;

  const prompt = `Assess donor eligibility for a blood donation request:
- Required blood type: ${bloodType}
- Patient blood type: ${patientBloodType ?? "unknown"}
- Days since last donation: ${daysSinceLastDonation} (minimum: 56 days)
- Patient weight: ${weightKg ?? "unknown"} kg (minimum: 50 kg)

Return JSON with:
- isEligible: boolean
- reason: string (short human-readable explanation)
- score: float 0-1 (higher = better candidate)`;

  const openAIEndpoint = process.env["AZURE_OPENAI_ENDPOINT"] ?? "";
  const deployment = process.env["AZURE_OPENAI_DEPLOYMENT"] ?? "gpt-4o";

  const client = new AzureOpenAI({
    endpoint: openAIEndpoint,
    apiKey: openAIKey,
    apiVersion: "2024-02-01"
  });

  const completion = await client.chat.completions.create({
    model: deployment,
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
    max_tokens: 200
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(raw) as DonorEligibility;
  } catch {
    return { isEligible: false, reason: "Could not assess eligibility", score: 0 };
  }
}

async function logToPostgres(requestId: string, hospitalId: string, donorCount: number): Promise<void> {
  const pgConnStr = process.env["POSTGRES_CONNECTION_STRING"];
  if (!pgConnStr) return;
  try {
    const { Pool } = await import("pg" as never) as { Pool: new (config: { connectionString: string }) => { query: (sql: string, params: unknown[]) => Promise<void>; end: () => Promise<void> } };
    const pool = new Pool({ connectionString: pgConnStr });
    await pool.query(
      "INSERT INTO donor_outreach_history (request_id, hospital_id, donor_count, queried_at) VALUES ($1, $2, $3, NOW())",
      [requestId, hospitalId, donorCount]
    );
    await pool.end();
  } catch {
    // Non-critical
  }
}

export async function fallbackDonors(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const requestId = randomUUID();
  const logger = createLogger("fallback-donors", requestId);
  const startTime = Date.now();

  const authError = validateApiKey(request);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { status: 400, jsonBody: { error: "Invalid JSON body", code: "BAD_REQUEST", requestId } };
  }

  const parsed = RequestBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      status: 400,
      jsonBody: { error: parsed.error.errors.map((e) => e.message).join(", "), code: "VALIDATION_ERROR", requestId },
    };
  }

  const { requestId: reqId, bloodType, hospitalId, location, limit = 5 } = parsed.data;

  try {
    const openAIKey = await getOpenAIKey();
    const fhirPatients = await queryFHIRPatients(bloodType);

    logger.info("Fetched FHIR patients", { count: fhirPatients.length });

    if (fhirPatients.length === 0) {
      return {
        status: 200,
        jsonBody: { requestId: reqId, donors: [], broadcastResults: [] } satisfies FallbackDonorsResponse,
      };
    }

    const hospitalLocation = location ?? { lat: 0, lng: 0 };

    const scoredDonors = await Promise.allSettled(
      fhirPatients.map(async (patient) => {
        const patientLocation = extractCoordinates(patient);
        let etaMinutes = 999;

        if (patientLocation) {
          const distanceKm = getDistance(patientLocation.lat, patientLocation.lng, hospitalLocation.lat, hospitalLocation.lng);
          etaMinutes = Math.round(distanceKm * 3);
        }

        const eligibility = await scoreWithOpenAI(patient, bloodType, openAIKey);
        const lastDonationDate = extractExtension(patient, "last-donation-date") as string | undefined;
        const weightKg = (extractExtension(patient, "weight") as number | undefined) ?? 0;

        const donorScore: DonorScore = {
          donor: {
            id: patient.id,
            bloodType: bloodType as DonorScore["donor"]["bloodType"],
            lastDonationDate: lastDonationDate ?? new Date(0).toISOString(),
            weightKg,
            isEligible: eligibility.isEligible,
            location: patientLocation ?? { lat: 0, lng: 0 },
            phone: extractPhone(patient),
            hospitalId,
          },
          score: eligibility.score,
          etaMinutes,
          eligibilityReason: eligibility.reason,
        };

        return donorScore;
      })
    );

    const eligibleDonors: DonorScore[] = scoredDonors
      .filter((r): r is PromiseFulfilledResult<DonorScore> => r.status === "fulfilled")
      .map((r) => r.value)
      .filter((d) => d.donor.isEligible)
      .sort((a, b) => b.score - a.score || a.etaMinutes - b.etaMinutes)
      .slice(0, limit);

    await logToPostgres(reqId, hospitalId, eligibleDonors.length);
    logger.trackRequest(Date.now() - startTime, 200);

    return {
      status: 200,
      jsonBody: { requestId: reqId, donors: eligibleDonors, broadcastResults: [] } satisfies FallbackDonorsResponse,
    };
  } catch (err) {
    logger.error("Fallback donors failed", err);
    return {
      status: 500,
      jsonBody: { error: err instanceof Error ? err.message : "Internal server error", code: "INTERNAL_ERROR", requestId },
    };
  }
}

app.http("fallback-donors", {
  methods: ["POST"],
  route: "fallback-donors",
  authLevel: "anonymous",
  handler: fallbackDonors,
});