/**
 * Health check — pings all 7 function endpoints.
 * Exits 0 if all pass, 1 if any fail.
 *
 * Usage:
 *   FUNCTIONS_BASE_URL=https://<apim>.azure-api.net/api APIM_SUBSCRIPTION_KEY=<key> pnpm health-check
 */
import * as https from "https";
import * as http from "http";
import * as dotenv from "dotenv";

dotenv.config();

const BASE_URL = process.env.FUNCTIONS_BASE_URL ?? "http://localhost:7071";
const API_KEY = process.env.APIM_SUBSCRIPTION_KEY ?? "dev-key";
const TIMEOUT_MS = 8000;

interface EndpointCheck {
  name: string;
  method: "GET" | "OPTIONS" | "POST";
  path: string;
  body?: string;
}

const ENDPOINTS: EndpointCheck[] = [
  { name: "parse-request", method: "OPTIONS", path: "/api/parse-request" },
  { name: "ranked-banks", method: "OPTIONS", path: "/api/ranked-banks" },
  { name: "broadcast", method: "OPTIONS", path: "/api/broadcast" },
  { name: "sms-webhook", method: "OPTIONS", path: "/api/sms-webhook" },
  { name: "fallback-donors", method: "OPTIONS", path: "/api/fallback-donors" },
  { name: "embed-token", method: "GET", path: "/api/embed-token" },
  { name: "speech-to-text", method: "OPTIONS", path: "/api/speech-to-text" },
];

async function checkEndpoint(endpoint: EndpointCheck): Promise<{ ok: boolean; ms: number; status: number }> {
  const url = new URL(endpoint.path, BASE_URL);
  const start = Date.now();

  return new Promise((resolve) => {
    const lib = url.protocol === "https:" ? https : http;
    const body = endpoint.body ?? "";

    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname,
        method: endpoint.method,
        headers: {
          "x-api-key": API_KEY,
          ...(body ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } : {}),
        },
        timeout: TIMEOUT_MS,
      },
      (res) => {
        res.resume(); // drain response
        res.on("end", () => {
          const ms = Date.now() - start;
          const ok = res.statusCode !== undefined && res.statusCode < 500;
          resolve({ ok, ms, status: res.statusCode ?? 0 });
        });
      }
    );

    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, ms: TIMEOUT_MS, status: 0 });
    });

    req.on("error", () => {
      resolve({ ok: false, ms: Date.now() - start, status: 0 });
    });

    if (body) req.write(body);
    req.end();
  });
}

async function main(): Promise<void> {
  console.log(`Health check — ${BASE_URL}\n`);

  const results: { endpoint: EndpointCheck; ok: boolean; ms: number; status: number }[] = [];

  for (const endpoint of ENDPOINTS) {
    const result = await checkEndpoint(endpoint);
    results.push({ endpoint, ...result });

    const icon = result.ok ? "+" : "x";
    const statusText = result.status === 0 ? "timeout" : `HTTP ${result.status}`;
    console.log(`  [${icon}] ${endpoint.name.padEnd(20)} ${result.ms}ms  (${statusText})`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} endpoints healthy`);

  if (failed.length > 0) {
    console.error(`\nFailed endpoints: ${failed.map((r) => r.endpoint.name).join(", ")}`);
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Health check error:", err.message ?? err);
  process.exit(1);
});
