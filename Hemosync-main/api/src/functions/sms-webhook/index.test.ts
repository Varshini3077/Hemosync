import { smsWebhook } from "./index";
import { HttpRequest, InvocationContext } from "@azure/functions";

jest.mock("../../middleware/keyvault", () => ({
  getCosmosKey: jest.fn().mockResolvedValue("mock-cosmos-key"),
  getACSKey: jest.fn().mockResolvedValue("mock-acs-connection-string"),
}));

const mockRequest = {
  id: "req-123",
  status: "BROADCASTING",
  interface: "WEB",
  coordinatorId: "coord-abc",
  bloodType: "O+",
  component: "PRBC",
  units: 2,
  hospitalId: "hosp-xyz",
  createdAt: new Date().toISOString(),
  broadcasts: [{ bankId: "bank-1", phone: "+919999000001" }],
};

jest.mock("@azure/cosmos", () => ({
  CosmosClient: jest.fn().mockImplementation(() => ({
    database: jest.fn().mockReturnValue({
      container: jest.fn().mockReturnValue({
        items: {
          query: jest.fn().mockReturnValue({
            fetchAll: jest.fn().mockResolvedValue({ resources: [mockRequest] }),
          }),
        },
        item: jest.fn().mockReturnValue({
          read: jest.fn().mockResolvedValue({ resource: mockRequest }),
          patch: jest.fn().mockResolvedValue({}),
        }),
      }),
    }),
  })),
}));

jest.mock("@azure/service-bus", () => ({
  ServiceBusClient: jest.fn().mockImplementation(() => ({
    createSender: jest.fn().mockReturnValue({
      sendMessages: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    }),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock("@azure/communication-sms", () => ({
  SmsClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue([{ httpStatusCode: 202 }]),
  })),
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

describe("sms-webhook function", () => {
  beforeEach(() => {
    process.env["COSMOS_DB_ENDPOINT"] = "https://mock.cosmos.azure.com";
    process.env["SERVICE_BUS_CONNECTION_STRING"] = "Endpoint=sb://mock.servicebus.windows.net/";
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("reply normalisation", () => {
    it("normalises 'YES 2' to YES with 2 units", async () => {
      const body = { from: "+919999000001", to: "+918888000000", body: "YES 2", messageSid: "msg-1", timestamp: new Date().toISOString() };
      const response = await smsWebhook(makeRequest(body), makeContext());
      expect(response.status).toBe(200);
      const json = response.jsonBody as Record<string, unknown>;
      expect(json["normalisedReply"]).toBe("YES");
    });

    it("normalises 'yes two units' to YES with 2 units", async () => {
      const body = { from: "+919999000001", to: "+918888000000", body: "yes two units", messageSid: "msg-2", timestamp: new Date().toISOString() };
      const response = await smsWebhook(makeRequest(body), makeContext());
      expect(response.status).toBe(200);
      const json = response.jsonBody as Record<string, unknown>;
      expect(json["normalisedReply"]).toBe("YES");
    });

    it("normalises 'y' to YES", async () => {
      const body = { from: "+919999000001", to: "+918888000000", body: "y", messageSid: "msg-3", timestamp: new Date().toISOString() };
      const response = await smsWebhook(makeRequest(body), makeContext());
      const json = response.jsonBody as Record<string, unknown>;
      expect(json["normalisedReply"]).toBe("YES");
    });

    it("normalises 'NO' to NO", async () => {
      const body = { from: "+919999000001", to: "+918888000000", body: "NO", messageSid: "msg-4", timestamp: new Date().toISOString() };
      const response = await smsWebhook(makeRequest(body), makeContext());
      const json = response.jsonBody as Record<string, unknown>;
      expect(json["normalisedReply"]).toBe("NO");
    });

    it("normalises 'n' to NO", async () => {
      const body = { from: "+919999000001", to: "+918888000000", body: "n", messageSid: "msg-5", timestamp: new Date().toISOString() };
      const response = await smsWebhook(makeRequest(body), makeContext());
      const json = response.jsonBody as Record<string, unknown>;
      expect(json["normalisedReply"]).toBe("NO");
    });

    it("normalises 'check' to CHECK", async () => {
      const body = { from: "+919999000001", to: "+918888000000", body: "check", messageSid: "msg-6", timestamp: new Date().toISOString() };
      const response = await smsWebhook(makeRequest(body), makeContext());
      const json = response.jsonBody as Record<string, unknown>;
      expect(json["normalisedReply"]).toBe("CHECK");
    });

    it("normalises '?' to CHECK", async () => {
      const body = { from: "+919999000001", to: "+918888000000", body: "?", messageSid: "msg-7", timestamp: new Date().toISOString() };
      const response = await smsWebhook(makeRequest(body), makeContext());
      const json = response.jsonBody as Record<string, unknown>;
      expect(json["normalisedReply"]).toBe("CHECK");
    });

    it("returns processed: false for unrecognised reply", async () => {
      const body = { from: "+919999000001", to: "+918888000000", body: "hello there", messageSid: "msg-8", timestamp: new Date().toISOString() };
      const response = await smsWebhook(makeRequest(body), makeContext());
      const json = response.jsonBody as Record<string, unknown>;
      expect(json["processed"]).toBe(false);
      expect(json["normalisedReply"]).toBeNull();
    });
  });

  it("happy path: updates request to CONFIRMED on YES reply", async () => {
    const body = {
      from: "+919999000001",
      to: "+918888000000",
      body: "YES 2",
      messageSid: "msg-yes-1",
      timestamp: new Date().toISOString(),
    };

    const response = await smsWebhook(makeRequest(body), makeContext());

    expect(response.status).toBe(200);
    const json = response.jsonBody as Record<string, unknown>;
    expect(json["processed"]).toBe(true);
    expect(json["requestId"]).toBe("req-123");
  });

  it("returns 400 when body is invalid JSON", async () => {
    const badRequest = {
      json: async () => { throw new Error("Invalid JSON"); },
      headers: { get: () => "valid-key" },
    } as unknown as HttpRequest;

    const response = await smsWebhook(badRequest, makeContext());
    expect(response.status).toBe(400);
  });

  it("returns 500 when Cosmos DB fails", async () => {
    const { CosmosClient } = await import("@azure/cosmos");
    (CosmosClient as jest.Mock).mockImplementationOnce(() => ({
      database: jest.fn().mockReturnValue({
        container: jest.fn().mockReturnValue({
          items: {
            query: jest.fn().mockReturnValue({
              fetchAll: jest.fn().mockRejectedValue(new Error("Cosmos DB unavailable")),
            }),
          },
        }),
      }),
    }));

    const body = {
      from: "+919999000001",
      to: "+918888000000",
      body: "YES 2",
      messageSid: "msg-fail-1",
      timestamp: new Date().toISOString(),
    };

    const response = await smsWebhook(makeRequest(body), makeContext());
    expect(response.status).toBe(500);
    const json = response.jsonBody as Record<string, unknown>;
    expect(json["code"]).toBe("INTERNAL_ERROR");
  });
});
