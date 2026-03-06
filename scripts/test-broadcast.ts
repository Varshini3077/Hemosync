/**
 * End-to-end smoke test: parse-request → ranked-banks → broadcast
 * Run against local Azure Functions: BASE_URL=http://localhost:7071
 */
import * as https from "https";
import * as http from "http";
import * as dotenv from "dotenv";

dotenv.config();

const BASE_URL = process.env.FUNCTIONS_BASE_URL ?? "http://localhost:7071";
const API_KEY = process.env.APIM_SUBSCRIPTION_KEY ?? "dev-key";

interface RequestOptions {
  method: string;
  path: string;
  body: Record<string, unknown>;
}

async function apiCall(options: RequestOptions): Promise<unknown> {
  const url = new URL(options.path, BASE_URL);
  const body = JSON.stringify(options.body);

  return new Promise((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: options.method,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "x-api-key": API_KEY,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          } else {
            try {
              resolve(JSON.parse(data));
            } catch {
              reject(new Error(`Invalid JSON response: ${data}`));
            }
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main(): Promise<void> {
  console.log(`Running end-to-end smoke test against ${BASE_URL}\n`);

  // Step 1: Parse request
  console.log("Step 1: POST /api/parse-request");
  const parseResult = await apiCall({
    method: "POST",
    path: "/api/parse-request",
    body: {
      text: "Need 2 units O+ blood urgently at AIIMS New Delhi",
      interface: "WEB",
      coordinatorId: "smoke-test-coordinator",
      hospitalId: "hosp_001",
    },
  }) as Record<string, unknown>;
  console.log("  Response:", JSON.stringify(parseResult, null, 2));

  const requestId = parseResult["requestId"] as string;
  if (!requestId) throw new Error("No requestId in parse response");
  console.log(`  requestId: ${requestId}\n`);

  // Step 2: Ranked banks
  console.log("Step 2: POST /api/ranked-banks");
  const rankResult = await apiCall({
    method: "POST",
    path: "/api/ranked-banks",
    body: {
      requestId,
      bloodType: parseResult["bloodType"],
      units: parseResult["units"],
      hospitalId: parseResult["hospitalId"],
      location: { lat: 28.5672, lng: 77.2100 },
    },
  }) as Record<string, unknown>;
  console.log("  Response:", JSON.stringify(rankResult, null, 2));

  const rankedBanks = rankResult["rankedBanks"] as unknown[];
  if (!rankedBanks || rankedBanks.length === 0) throw new Error("No ranked banks returned");
  console.log(`  Top bank: ${(rankedBanks[0] as Record<string, unknown>)["name"]}\n`);

  // Step 3: Broadcast
  console.log("Step 3: POST /api/broadcast");
  const broadcastResult = await apiCall({
    method: "POST",
    path: "/api/broadcast",
    body: {
      requestId,
      bloodType: parseResult["bloodType"],
      units: parseResult["units"],
      hospitalName: parseResult["hospitalName"],
      banks: (rankedBanks as Record<string, unknown>[]).slice(0, 5).map((b) => ({
        bankId: b["bankId"],
        name: b["name"],
        phone: b["phone"],
      })),
    },
  }) as Record<string, unknown>;
  console.log("  Response:", JSON.stringify(broadcastResult, null, 2));

  console.log("\nSmoke test passed. Full broadcast flow completed successfully.");
  process.exit(0);
}

main().catch((err) => {
  console.error("\nSmoke test FAILED:", err.message ?? err);
  process.exit(1);
});
