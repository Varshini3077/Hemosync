import { parseRequest } from "./index";
import { HttpRequest, InvocationContext } from "@azure/functions";

// Mock modules
jest.mock("../../middleware/keyvault", () => ({
  getOpenAIKey: jest.fn().mockResolvedValue("mock-openai-key"),
  getCosmosKey: jest.fn().mockResolvedValue("mock-cosmos-key"),
}));

jest.mock("@azure/openai", () => ({
  OpenAIClient: jest.fn().mockImplementation(() => ({
    getChatCompletions: jest.fn().mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            bloodType: "O+",
            component: "PRBC",
            units: 2,
            urgency: "CRITICAL",
            location: "City Hospital",
            confidence: 0.95,
            clarifications: [],
          }),
        },
      }],
    }),
  })),
  AzureKeyCredential: jest.fn(),
}));

jest.mock("@azure/cosmos", () => ({
  CosmosClient: jest.fn().mockImplementation(() => ({
    database: jest.fn().mockReturnValue({
      container: jest.fn().mockReturnValue({
        items: {
          create: jest.fn().mockResolvedValue({}),
        },
      }),
    }),
  })),
}));

jest.mock("../../middleware/auth", () => ({
  validateApiKey: jest.fn().mockReturnValue(null),
}));

function makeRequest(body: unknown): HttpRequest {
  return {
    json: async () => body,
    headers: { get: () => "valid-key" },
  } as unknown as HttpRequest;
}

function makeContext(): InvocationContext {
  return {} as InvocationContext;
}

describe("parse-request function", () => {
  beforeEach(() => {
    process.env["AZURE_OPENAI_ENDPOINT"] = "https://mock.openai.azure.com";
    process.env["AZURE_OPENAI_DEPLOYMENT"] = "gpt-4o";
    process.env["COSMOS_DB_ENDPOINT"] = "https://mock.cosmos.azure.com";
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("happy path: parses a valid blood request and returns structured data", async () => {
    const body = {
      rawText: "Need 2 units of O+ PRBC urgently for patient in City Hospital",
      interface: "WEB",
      coordinatorId: "coord-123",
      hospitalId: "hosp-456",
    };

    const response = await parseRequest(makeRequest(body), makeContext());

    expect(response.status).toBe(200);
    const json = response.jsonBody as Record<string, unknown>;
    expect(json["bloodType"]).toBe("O+");
    expect(json["component"]).toBe("PRBC");
    expect(json["units"]).toBe(2);
    expect(json["urgency"]).toBe("CRITICAL");
    expect(json["requestId"]).toBeDefined();
    expect(json["confidence"]).toBeGreaterThan(0);
  });

  it("returns 400 when required fields are missing", async () => {
    const body = {
      rawText: "Need blood",
      // missing interface, coordinatorId, hospitalId
    };

    const response = await parseRequest(makeRequest(body), makeContext());

    expect(response.status).toBe(400);
    const json = response.jsonBody as Record<string, unknown>;
    expect(json["code"]).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when rawText is empty", async () => {
    const body = {
      rawText: "",
      interface: "WEB",
      coordinatorId: "coord-123",
      hospitalId: "hosp-456",
    };

    const response = await parseRequest(makeRequest(body), makeContext());

    expect(response.status).toBe(400);
    const json = response.jsonBody as Record<string, unknown>;
    expect(json["code"]).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when body is invalid JSON", async () => {
    const badRequest = {
      json: async () => { throw new Error("Invalid JSON"); },
      headers: { get: () => "valid-key" },
    } as unknown as HttpRequest;

    const response = await parseRequest(badRequest, makeContext());

    expect(response.status).toBe(400);
    const json = response.jsonBody as Record<string, unknown>;
    expect(json["code"]).toBe("BAD_REQUEST");
  });

  it("returns 500 when Azure OpenAI fails", async () => {
    const { OpenAIClient } = await import("@azure/openai");
    (OpenAIClient as jest.Mock).mockImplementationOnce(() => ({
      getChatCompletions: jest.fn().mockRejectedValue(new Error("OpenAI service unavailable")),
    }));

    const body = {
      rawText: "Need 2 units O+ blood urgently",
      interface: "WEB",
      coordinatorId: "coord-123",
      hospitalId: "hosp-456",
    };

    const response = await parseRequest(makeRequest(body), makeContext());

    expect(response.status).toBe(500);
    const json = response.jsonBody as Record<string, unknown>;
    expect(json["code"]).toBe("INTERNAL_ERROR");
    expect(json["requestId"]).toBeDefined();
  });

  it("returns 401 when API key is invalid", async () => {
    const { validateApiKey } = await import("../../middleware/auth");
    (validateApiKey as jest.Mock).mockReturnValueOnce({
      status: 401,
      jsonBody: { error: "Invalid API key", code: "UNAUTHORIZED" },
    });

    const body = {
      rawText: "Need 2 units O+ blood",
      interface: "WEB",
      coordinatorId: "coord-123",
      hospitalId: "hosp-456",
    };

    const response = await parseRequest(makeRequest(body), makeContext());

    expect(response.status).toBe(401);
  });
});
