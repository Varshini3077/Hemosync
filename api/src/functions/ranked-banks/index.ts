import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { CosmosClient } from "@azure/cosmos";
import { MapsRouteClient, RouteType } from "@azure/maps-route";
import { AzureKeyCredential } from "@azure/core-auth";
import Redis from "ioredis";
import { z } from "zod";
import { randomUUID } from "crypto";
import { validateApiKey } from "../../middleware/auth.js";
import { createLogger } from "../../middleware/logger.js";
import { getCosmosKey, getMapsKey } from "../../middleware/keyvault.js";
import type { RankedBanksResponse } from "@hemosync/types";

const RequestBodySchema = z.object({
  requestId: z.string().min(1),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  bloodType: z.string().min(1),
  component: z.string().min(1),
});

let redisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (!redisClient) {
    const redisUrl = process.env["REDIS_CONNECTION_STRING"] ?? "redis://localhost:6379";
    redisClient = new Redis(redisUrl);
  }
  return redisClient;
}

function roundCoord(val: number, precision = 2): string {
  return val.toFixed(precision);
}

const CACHE_TTL_SECONDS = 300; // 5 minutes

function scoreBank(reliabilityScore: number, etaMinutes: number, maxEta: number, inventorySignal: number): number {
  const normalizedETA = maxEta > 0 ? etaMinutes / maxEta : 0;
  return 0.4 * reliabilityScore + 0.4 * (1 - normalizedETA) + 0.2 * inventorySignal;
}

export async function rankedBanks(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const requestId = randomUUID();
  const logger = createLogger("ranked-banks", requestId);
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
        error: parsed.error.errors.map((e) => e.message).join(", "),
        code: "VALIDATION_ERROR",
        requestId,
      },
    };
  }

  const { location, bloodType, component } = parsed.data;

  try {
    const cacheKey = `banks:${roundCoord(location.lat)}:${roundCoord(location.lng)}`;
    const redis = getRedisClient();

    let rawBanks: Array<{
      id: string;
      name: string;
      phone: string;
      address: string;
      location: { lat: number; lng: number };
      reliabilityScore: number;
      inventorySignal: number;
      isActive: boolean;
      lastUpdated: string;
    }> | null = null;

    const cached = await redis.get(cacheKey).catch(() => null);

    if (cached) {
      logger.info("Cache hit for nearby banks", { cacheKey });
      rawBanks = JSON.parse(cached) as typeof rawBanks;
    } else {
      logger.info("Cache miss — querying Cosmos DB", { cacheKey });
      const cosmosKey = await getCosmosKey();
      const cosmosEndpoint = process.env["COSMOS_DB_ENDPOINT"] ?? "";
      const cosmosClient = new CosmosClient({ endpoint: cosmosEndpoint, key: cosmosKey });
      const container = cosmosClient.database("hemosync").container("blood-banks");

      const { resources } = await container.items
        .query({
          query: "SELECT * FROM c WHERE c.isActive = true",
        })
        .fetchAll();

      rawBanks = resources as typeof rawBanks;

      await redis
        .setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(rawBanks))
        .catch(() => logger.warn("Failed to write to Redis cache"));
    }

    // Filter banks with matching blood type inventory signal (if available)
    const activeBanks = (rawBanks ?? []).filter((b) => b.isActive);

    if (activeBanks.length === 0) {
      return {
        status: 200,
        jsonBody: { banks: [] } satisfies RankedBanksResponse,
      };
    }

    // Get ETAs from Azure Maps Route
    const mapsKey = await getMapsKey();
    const mapsClient = new MapsRouteClient(new AzureKeyCredential(mapsKey));

    logger.info("Fetching ETAs from Azure Maps", { bankCount: activeBanks.length });

    const etaResults = await Promise.allSettled(
      activeBanks.map(async (bank) => {
        const routeResult = await mapsClient.getRouteDirections({
          routePoints: [
            { latitude: location.lat, longitude: location.lng },
            { latitude: bank.location.lat, longitude: bank.location.lng },
          ],
          routeType: RouteType.Fastest,
        });
        const summary = routeResult.routes?.[0]?.summary;
        const etaMinutes = summary ? Math.round(summary.travelTimeInSeconds / 60) : 999;
        const distanceKm = summary ? Math.round(summary.lengthInMeters / 100) / 10 : 999;
        return { bankId: bank.id, etaMinutes, distanceKm };
      })
    );

    const etaMap = new Map<string, { etaMinutes: number; distanceKm: number }>();
    for (let i = 0; i < activeBanks.length; i++) {
      const bank = activeBanks[i];
      const result = etaResults[i];
      if (result && bank) {
        if (result.status === "fulfilled") {
          etaMap.set(bank.id, result.value);
        } else {
          etaMap.set(bank.id, { etaMinutes: 999, distanceKm: 999 });
        }
      }
    }

    const maxEta = Math.max(...Array.from(etaMap.values()).map((v) => v.etaMinutes));

    const scoredBanks = activeBanks.map((bank) => {
      const eta = etaMap.get(bank.id) ?? { etaMinutes: 999, distanceKm: 999 };
      const compositeScore = scoreBank(
        bank.reliabilityScore,
        eta.etaMinutes,
        maxEta,
        bank.inventorySignal ?? 0.5
      );
      return {
        id: bank.id,
        name: bank.name,
        phone: bank.phone,
        address: bank.address,
        location: bank.location,
        reliabilityScore: bank.reliabilityScore,
        isActive: bank.isActive,
        lastUpdated: new Date(bank.lastUpdated),
        distanceKm: eta.distanceKm,
        estimatedDriveMinutes: eta.etaMinutes,
        compositeScore,
      };
    });

    scoredBanks.sort((a, b) => b.compositeScore - a.compositeScore);
    const top5 = scoredBanks.slice(0, 5);

    logger.info("Ranked banks computed", { bloodType, component, resultCount: top5.length });
    logger.trackRequest(Date.now() - startTime, 200);

    return {
      status: 200,
      jsonBody: { banks: top5 } satisfies RankedBanksResponse,
    };
  } catch (err) {
    logger.error("Failed to rank banks", err);
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

app.http("ranked-banks", {
  methods: ["POST"],
  route: "ranked-banks",
  authLevel: "anonymous",
  handler: rankedBanks,
});
