import { embedToken } from "./index";
import { HttpRequest, InvocationContext } from "@azure/functions";

jest.mock("../../middleware/auth", () => ({
  validateApiKey: jest.fn().mockReturnValue(null),
}));

const mockExpirationDate = new Date(Date.now() + 3600 * 1000).toISOString();

jest.mock("axios", () => ({
  post: jest.fn().mockImplementation(async (url: string) => {
    if (url.includes("oauth2")) {
      return { data: { access_token: "mock-msal-token", expires_in: 3600, token_type: "Bearer" } };
    }
    if (url.includes("GenerateToken")) {
      return { data: { token: "mock-embed-token", tokenId: "token-id-1", expiration: mockExpirationDate } };
    }
    return {};
  }),
  get: jest.fn().mockResolvedValue({
    data: {
      id: "report-id-1",
      datasetId: "dataset-id-1",
      embedUrl: "https://app.powerbi.com/reportEmbed?reportId=report-id-1",
    },
  }),
}));

function makeRequest(): HttpRequest {
  return {
    json: async () => ({}),
    headers: { get: () => "valid-key" },
  } as unknown as HttpRequest;
}

function makeContext(): InvocationContext {
  return {} as InvocationContext;
}

describe("embed-token function", () => {
  beforeEach(() => {
    process.env["POWERBI_TENANT_ID"] = "mock-tenant-id";
    process.env["POWERBI_CLIENT_ID"] = "mock-client-id";
    process.env["POWERBI_CLIENT_SECRET"] = "mock-client-secret";
    process.env["POWERBI_REPORT_ID"] = "mock-report-id";
    process.env["POWERBI_WORKSPACE_ID"] = "mock-workspace-id";
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("happy path: returns embed token with all required fields", async () => {
    const response = await embedToken(makeRequest(), makeContext());

    expect(response.status).toBe(200);
    const json = response.jsonBody as Record<string, unknown>;
    expect(json["token"]).toBe("mock-embed-token");
    expect(json["embedUrl"]).toContain("powerbi.com");
    expect(typeof json["expiry"]).toBe("number");
    expect(json["reportId"]).toBeDefined();
    expect(json["datasetId"]).toBeDefined();
  });

  it("returns 500 when Power BI env vars are missing", async () => {
    delete process.env["POWERBI_TENANT_ID"];

    const response = await embedToken(makeRequest(), makeContext());

    expect(response.status).toBe(500);
    const json = response.jsonBody as Record<string, unknown>;
    expect(json["code"]).toBe("CONFIGURATION_ERROR");
  });

  it("returns 500 when MSAL token acquisition fails", async () => {
    const axios = await import("axios");
    (axios.post as jest.Mock).mockRejectedValueOnce(new Error("MSAL service unavailable"));

    const response = await embedToken(makeRequest(), makeContext());

    expect(response.status).toBe(500);
    const json = response.jsonBody as Record<string, unknown>;
    expect(json["code"]).toBe("INTERNAL_ERROR");
    expect(json["requestId"]).toBeDefined();
  });

  it("returns 500 when Power BI API fails to generate embed token", async () => {
    const axios = await import("axios");
    // MSAL succeeds, report GET succeeds, but GenerateToken fails
    (axios.post as jest.Mock)
      .mockResolvedValueOnce({ data: { access_token: "mock-token", expires_in: 3600, token_type: "Bearer" } })
      .mockRejectedValueOnce(new Error("Power BI service unavailable"));

    const response = await embedToken(makeRequest(), makeContext());

    expect(response.status).toBe(500);
    const json = response.jsonBody as Record<string, unknown>;
    expect(json["code"]).toBe("INTERNAL_ERROR");
  });

  it("returns 401 when API key is missing", async () => {
    const { validateApiKey } = await import("../../middleware/auth");
    (validateApiKey as jest.Mock).mockReturnValueOnce({
      status: 401,
      jsonBody: { error: "Missing API key", code: "UNAUTHORIZED" },
    });

    const response = await embedToken(makeRequest(), makeContext());

    expect(response.status).toBe(401);
  });
});
