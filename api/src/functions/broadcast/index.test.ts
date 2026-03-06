import { broadcastHttp, processBroadcastJob } from "./index";
import { HttpRequest, InvocationContext } from "@azure/functions";
import type { BroadcastJob } from "@hemosync/types";

jest.mock("../../middleware/keyvault", () => ({
  getCosmosKey: jest.fn().mockResolvedValue("mock-cosmos-key"),
  getMsg91Key: jest.fn().mockResolvedValue("mock-msg91-key"),
}));

jest.mock("axios", () => ({
  post: jest.fn().mockResolvedValue({ data: { request_id: "msg91-abc123" } }),
}));

jest.mock("@azure/cosmos", () => ({
  CosmosClient: jest.fn().mockImplementation(() => ({
    database: jest.fn().mockReturnValue({
      container: jest.fn().mockReturnValue({
        item: jest.fn().mockReturnValue({
          read: jest.fn().mockResolvedValue({ resource: { id: "req-123", broadcasts: [], status: "PENDING" } }),
          patch: jest.fn().mockResolvedValue({}),
        }),
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
  return { log: jest.fn() } as unknown as InvocationContext;
}

const validBody = {
  requestId: "req-123",
  bloodType: "O+",
  component: "PRBC",
  units: 2,
  banks: [
    { id: "bank-1", name: "Central Blood Bank", phone: "+919999000001" },
    { id: "bank-2", name: "North Blood Bank", phone: "+919999000002" },
  ],
};

describe("broadcast HTTP function", () => {
  beforeEach(() => {
    process.env["COSMOS_DB_ENDPOINT"] = "https://mock.cosmos.azure.com";
    process.env["MSG91_TEMPLATE_ID"] = "template-123";
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("happy path: broadcasts SMS to all banks and returns results", async () => {
    const response = await broadcastHttp(makeRequest(validBody), makeContext());

    expect(response.status).toBe(200);
    const json = response.jsonBody as Record<string, unknown>;
    expect(json["broadcastId"]).toBeDefined();
    expect(json["totalBanks"]).toBe(2);
    expect(json["successCount"]).toBe(2);
  });

  it("returns 400 when required fields are missing", async () => {
    const body = { requestId: "req-123" }; // missing banks, bloodType, etc.

    const response = await broadcastHttp(makeRequest(body), makeContext());

    expect(response.status).toBe(400);
    const json = response.jsonBody as Record<string, unknown>;
    expect(json["code"]).toBe("VALIDATION_ERROR");
  });

  it("returns 500 when MSG91 key retrieval fails", async () => {
    const { getMsg91Key } = await import("../../middleware/keyvault");
    (getMsg91Key as jest.Mock).mockRejectedValueOnce(new Error("Key Vault unavailable"));

    const response = await broadcastHttp(makeRequest(validBody), makeContext());

    expect(response.status).toBe(500);
    const json = response.jsonBody as Record<string, unknown>;
    expect(json["code"]).toBe("INTERNAL_ERROR");
  });

  it("constructs correct SMS text with all required fields", async () => {
    const axios = await import("axios");
    let capturedMessage = "";
    (axios.post as jest.Mock).mockImplementation(async (_url, data: { recipients?: Array<{ message?: string }> }) => {
      capturedMessage = data.recipients?.[0]?.message ?? "";
      return { data: { request_id: "msg-abc" } };
    });

    await broadcastHttp(makeRequest(validBody), makeContext());

    expect(capturedMessage).toContain("HEMOSYNC ALERT");
    expect(capturedMessage).toContain("2 units");
    expect(capturedMessage).toContain("O+");
    expect(capturedMessage).toContain("PRBC");
    expect(capturedMessage).toContain("req-123");
    expect(capturedMessage).toContain("YES");
    expect(capturedMessage).toContain("NO");
    expect(capturedMessage).toContain("CHECK");
  });
});

describe("broadcast Service Bus handler", () => {
  it("happy path: processes broadcast job and logs to Cosmos DB", async () => {
    const job: BroadcastJob = {
      requestId: "req-456",
      banks: [
        { id: "bank-1", name: "Central Blood Bank", phone: "+919999000001", address: "123 Main St", location: { lat: 12.97, lng: 77.59 }, reliabilityScore: 0.9, isActive: true, lastUpdated: new Date() },
      ],
      message: "HEMOSYNC ALERT: Need 2 units O+ PRBC. Reply: YES 2 / NO / CHECK. Req ID: req-456",
      sentAt: new Date(),
      timeoutMs: 300000,
    };

    await expect(processBroadcastJob(job, makeContext())).resolves.not.toThrow();
  });

  it("throws when Cosmos DB patch fails", async () => {
    const { CosmosClient } = await import("@azure/cosmos");
    (CosmosClient as jest.Mock).mockImplementationOnce(() => ({
      database: jest.fn().mockReturnValue({
        container: jest.fn().mockReturnValue({
          item: jest.fn().mockReturnValue({
            read: jest.fn().mockResolvedValue({ resource: { id: "req-456", broadcasts: [] } }),
            patch: jest.fn().mockRejectedValue(new Error("Cosmos DB unavailable")),
          }),
        }),
      }),
    }));

    const job: BroadcastJob = {
      requestId: "req-456",
      banks: [
        { id: "bank-1", name: "Central Blood Bank", phone: "+919999000001", address: "123 Main St", location: { lat: 12.97, lng: 77.59 }, reliabilityScore: 0.9, isActive: true, lastUpdated: new Date() },
      ],
      message: "HEMOSYNC ALERT: Need 2 units O+ PRBC. Reply: YES 2 / NO / CHECK. Req ID: req-456",
      sentAt: new Date(),
      timeoutMs: 300000,
    };

    await expect(processBroadcastJob(job, makeContext())).rejects.toThrow("Cosmos DB unavailable");
  });
});
