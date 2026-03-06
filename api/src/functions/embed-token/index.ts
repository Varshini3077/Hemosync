import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import axios from "axios";
import { randomUUID } from "crypto";
import { validateApiKey } from "../../middleware/auth.js";
import { createLogger } from "../../middleware/logger.js";
import type { EmbedTokenResponse } from "@hemosync/types";

interface MSALTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface PowerBIEmbedTokenResponse {
  token: string;
  tokenId: string;
  expiration: string;
}

interface PowerBIReportResponse {
  id: string;
  datasetId: string;
  embedUrl: string;
}

async function getMsalToken(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://analysis.windows.net/powerbi/api/.default",
  });

  const response = await axios.post<MSALTokenResponse>(tokenEndpoint, params.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 15000,
  });

  return response.data.access_token;
}

async function getPowerBIEmbedToken(
  accessToken: string,
  workspaceId: string,
  reportId: string
): Promise<{ token: string; expiry: number; embedUrl: string; datasetId: string }> {
  const reportsUrl = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/reports/${reportId}`;

  const reportResponse = await axios.get<PowerBIReportResponse>(reportsUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 15000,
  });

  const { embedUrl, datasetId } = reportResponse.data;

  const embedTokenUrl = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/reports/${reportId}/GenerateToken`;

  const tokenResponse = await axios.post<PowerBIEmbedTokenResponse>(
    embedTokenUrl,
    {
      accessLevel: "View",
      datasetId,
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    }
  );

  const expiry = new Date(tokenResponse.data.expiration).getTime();

  return {
    token: tokenResponse.data.token,
    expiry,
    embedUrl,
    datasetId,
  };
}

export async function embedToken(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const requestId = randomUUID();
  const logger = createLogger("embed-token", requestId);
  const startTime = Date.now();

  const authError = validateApiKey(request);
  if (authError) return authError;

  const tenantId = process.env["POWERBI_TENANT_ID"];
  const clientId = process.env["POWERBI_CLIENT_ID"];
  const clientSecret = process.env["POWERBI_CLIENT_SECRET"];
  const reportId = process.env["POWERBI_REPORT_ID"];
  const workspaceId = process.env["POWERBI_WORKSPACE_ID"];

  if (!tenantId || !clientId || !clientSecret || !reportId || !workspaceId) {
    return {
      status: 500,
      jsonBody: {
        error: "Missing required Power BI environment variables",
        code: "CONFIGURATION_ERROR",
        requestId,
      },
    };
  }

  try {
    logger.info("Acquiring MSAL token for Power BI");
    const accessToken = await getMsalToken(tenantId, clientId, clientSecret);

    logger.info("Generating Power BI embed token", { reportId, workspaceId });
    const { token, expiry, embedUrl, datasetId } = await getPowerBIEmbedToken(
      accessToken,
      workspaceId,
      reportId
    );

    logger.trackRequest(Date.now() - startTime, 200);

    const response: EmbedTokenResponse = {
      token,
      expiry,
      embedUrl,
      reportId,
      datasetId,
    };

    return { status: 200, jsonBody: response };
  } catch (err) {
    logger.error("Failed to generate embed token", err);
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

app.http("embed-token", {
  methods: ["GET"],
  route: "embed-token",
  authLevel: "anonymous",
  handler: embedToken,
});
