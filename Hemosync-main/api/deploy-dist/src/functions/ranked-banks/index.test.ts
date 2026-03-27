import { rankedBanks } from "./index";
import { HttpRequest, InvocationContext } from "@azure/functions";

jest.mock("../../middleware/keyvault", () => ({
  getCosmosKey: jest.fn().mockResolvedValue("mock-cosmos-key"),
  getMapsKey: jest.fn().mockResolvedValue("mock-maps-key"),
}));

const mockBanks = [
  {
    id: "bank-1",
    name: "Central Blood Bank",
    phone: "+91-9999-000001",
    address: "123 Main St",
    location: { lat: 12.97, lng: 77.59 },
    reliabilityScore: 0.9,
    inventorySignal: 0.8,
    isActive: true,
    lastUpdated: new Date().toISOString(),
  },
  {
    id: "bank-2",
    name: "North Blood Bank",
    phone: "+91-9999-000002",
    address: "456 North Ave",
    location: { lat: 13.02, lng: 77.55 },
    reliabilityScore: 0.7,
    inventorySignal: 0.6,
    isActive: true,
    lastUpdated: new Date().toISOString(),
  },
];

jest.mock("@azure/cosmos", () => ({
  CosmosClient: jest.fn().mockImplementation(() => ({
    database: jest.fn().mockReturnValue({
      container: jest.fn().mockReturnValue({
        items: {
          query: jest.fn().mockReturnValue({
            fetchAll: jest.fn().mockResolvedValue({ resources: mockBanks }),
          }),
        },
      }),
    }),
  })),
}));

jest.mock("@azure/maps-route", () => ({
  MapsRouteClient: jest.fn().mockImplementation(() => ({
    getRouteDirections: jest.fn().mockResolvedValue({
      routes: [{
        summary: {
          travelTimeInSeconds: 900,
          lengthInMeters: 5000,
        },
      }],
    }),
  })),
  RouteType: { Fastest: "fastest" },
}));

jest.mock("ioredis", () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue("OK"),
  }));
});

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

describe("ranked-banks function", () => {
  beforeEach(() => {
    process.env["COSMOS_DB_ENDPOINT"] = "https://mock.cosmos.azure.com";
    process.env["REDIS_CONNECTION_STRING"] = "redis://localhost:6379";
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("happy path: returns ranked list of blood banks", async () => {
    const body = {
      requestId: "req-123",
      location: { lat: 12.97, lng: 77.59 },
      bloodType: "O+",
      component: "PRBC",
    };

    const response = await rankedBanks(makeRequest(body), makeContext());

    expect(response.status).toBe(200);
    const json = response.jsonBody as { banks: unknown[] };
    expect(Array.isArray(json.banks)).toBe(true);
    expect(json.banks.length).toBeGreaterThan(0);
    const firstBank = json.banks[0] as Record<string, unknown>;
    expect(firstBank["compositeScore"]).toBeDefined();
    expect(firstBank["estimatedDriveMinutes"]).toBeDefined();
  });

  it("returns 400 when required fields are missing", async () => {
    const body = {
      requestId: "req-123",
      // missing location, bloodType, component
    };

    const response = await rankedBanks(makeRequest(body), makeContext());

    expect(response.status).toBe(400);
    const json = response.jsonBody as Record<string, unknown>;
    expect(json["code"]).toBe("VALIDATION_ERROR");
  });

  it("uses Redis cache when available", async () => {
    const Redis = (await import("ioredis")).default;
    (Redis as jest.Mock).mockImplementationOnce(() => ({
      get: jest.fn().mockResolvedValue(JSON.stringify(mockBanks)),
      setex: jest.fn().mockResolvedValue("OK"),
    }));

    const body = {
      requestId: "req-123",
      location: { lat: 12.97, lng: 77.59 },
      bloodType: "O+",
      component: "PRBC",
    };

    const response = await rankedBanks(makeRequest(body), makeContext());
    expect(response.status).toBe(200);
  });

  it("returns 500 when Azure Maps fails", async () => {
    const { MapsRouteClient } = await import("@azure/maps-route");
    (MapsRouteClient as jest.Mock).mockImplementationOnce(() => ({
      getRouteDirections: jest.fn().mockRejectedValue(new Error("Maps service unavailable")),
    }));

    const body = {
      requestId: "req-123",
      location: { lat: 12.97, lng: 77.59 },
      bloodType: "O+",
      component: "PRBC",
    };

    const response = await rankedBanks(makeRequest(body), makeContext());
    expect(response.status).toBe(500);
    const json = response.jsonBody as Record<string, unknown>;
    expect(json["code"]).toBe("INTERNAL_ERROR");
  });
});
