import * as appInsights from "applicationinsights";

let initialized = false;

function ensureInitialized(): void {
  if (!initialized && process.env["APPLICATIONINSIGHTS_CONNECTION_STRING"]) {
    appInsights
      .setup(process.env["APPLICATIONINSIGHTS_CONNECTION_STRING"])
      .setAutoDependencyCorrelation(true)
      .setAutoCollectRequests(true)
      .setAutoCollectPerformance(true)
      .setAutoCollectExceptions(true)
      .setAutoCollectDependencies(true)
      .start();
    initialized = true;
  }
}

export interface LogEntry {
  timestamp: string;
  functionName: string;
  requestId: string;
  durationMs?: number;
  status?: number;
  message: string;
  level: "info" | "warn" | "error";
  [key: string]: unknown;
}

export function createLogger(functionName: string, requestId: string) {
  ensureInitialized();

  const client = initialized ? appInsights.defaultClient : null;

  return {
    info(message: string, extra?: Record<string, unknown>): void {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        functionName,
        requestId,
        message,
        level: "info",
        ...extra,
      };
      console.log(JSON.stringify(entry));
      client?.trackTrace({ message: JSON.stringify(entry), severity: appInsights.Contracts.SeverityLevel.Information, properties: { functionName, requestId, ...extra } });
    },

    warn(message: string, extra?: Record<string, unknown>): void {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        functionName,
        requestId,
        message,
        level: "warn",
        ...extra,
      };
      console.warn(JSON.stringify(entry));
      client?.trackTrace({ message: JSON.stringify(entry), severity: appInsights.Contracts.SeverityLevel.Warning, properties: { functionName, requestId, ...extra } });
    },

    error(message: string, error?: unknown, extra?: Record<string, unknown>): void {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        functionName,
        requestId,
        message,
        level: "error",
        error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
        ...extra,
      };
      console.error(JSON.stringify(entry));
      if (error instanceof Error) {
        client?.trackException({ exception: error, properties: { functionName, requestId, ...extra } });
      }
    },

    trackRequest(durationMs: number, status: number): void {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        functionName,
        requestId,
        durationMs,
        status,
        message: `Request completed in ${durationMs}ms with status ${status}`,
        level: "info",
      };
      console.log(JSON.stringify(entry));
      client?.trackMetric({ name: `${functionName}.durationMs`, value: durationMs, properties: { functionName, requestId, status: String(status) } });
    },
  };
}

export type Logger = ReturnType<typeof createLogger>;
