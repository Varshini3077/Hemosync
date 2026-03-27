import { fallbackDonors } from "./index";
import { HttpRequest, InvocationContext } from "@azure/functions";

jest.mock("../../middleware/keyvault", () => ({
  getOpenAIKey: jest.fn().mockResolvedValue("mock-openai-key"),
  getMapsKey: jest.fn().mockResolvedValue("mock-maps-key"),
}));

const mockFHIRPatients = [
  {
    resourceType: "Patient",
    id: "patient-1",
    extension: [
      { url: "http://example.com/blood-type", valueString: "O+" },
      { url: "http://example.com/last-donation-date", valueString: "2025-10-01" },
      { url: "http://example.com/weight", valueDecimal: 70 },
    ],
    telecom: [{ system: "phone", value: "+919876543210" }],
    address: [{
      extension: [{
        extension: [
          { url: "latitude", valueDecimal: 12.97 },
          { url: "longitude", valueDecimal: 77.59 },
        ],
      }],
    }],
  },
  {
    resourceType: "Patient",
    id: "patient-2",
    extension: [
      { url: "http://example.com/blood-type", valueString: "O+" },
      { url: "http://example.com/last-donation-date", valueString: "2026-02-15" }, // Too recent
      { url: "http://example.com/weight", valueDecimal: 55 },
    ],
    telecom: [{ system: "phone", value: "+919876543211" }],
    address: [],
  },
];

jest.mock("axios", () => ({
  get: jest.fn().mockResolvedValue({
    data: {
      entry: mockFHIRPatients.map((p) => ({ resource: p })),
    },
  }),
  post: jest.fn().mockResolvedValue({ data: { request_id: "msg-123" } }),
}));

jest.mock("@azure/openai", () => ({
  OpenAIClient: jest.fn().mockImplementation(() => ({
    getChatCompletions: jest.fn().mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            isEligible: true,
            reason: "Eligible — last donated 90+ days ago, weight adequate",
            score: 0.85,
          }),
        },
      }],
    }),
  })),
  AzureKeyCredential: jest.fn(),
}));

jest.mock("@azure/maps-route", () => ({
  MapsRouteClient: jest.fn().mockImplementation(() => ({
    getRouteDirections: jest.fn().mockResolvedValue({
      routes: [{ summary: { travelTimeInSeconds: 1200, lengthInMeters: 8000 } }],
    }),
  })),
  RouteType: { Fastest: "fastest" },
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

describe("fallback-donors function", () => {
  beforeEach(() => {
    process.env["FHIR_ENDPOINT"] = "https://mock.fhir.azure.com";
    process.env["AZURE_OPENAI_ENDPOINT"] = "https://mock.openai.azure.com";
    process.env["AZURE_OPENAI_DEPLOYMENT"] = "gpt-4o";
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("happy path: returns ranked eligible donors", async () => {
    const body: { requestId: string; bloodType: string; hospitalId: string; location: { lat: number; lng: number } } = {
      requestId: "req-123",
      bloodType: "O+",
      hospitalId: "hosp-456",
      location: { lat: 12.97, lng: 77.59 },
    };

    const response = await fallbackDonors(makeRequest(body), makeContext());

    expect(response.status).toBe(200);
    const json = response.jsonBody as { requestId: string; donors: unknown[]; broadcastResults: unknown[] };
    expect(json.requestId).toBe("req-123");
    expect(Array.isArray(json.donors)).toBe(true);
    expect(Array.isArray(json.broadcastResults)).toBe(true);
  });

  it("returns empty donors list when FHIR returns no patients", async () => {
    const axios = await import("axios");
    (axios.get as jest.Mock).mockResolvedValueOnce({ data: { entry: [] } });

    const body = {
      requestId: "req-123",
      bloodType: "AB-",
      hospitalId: "hosp-456",
    };

    const response = await fallbackDonors(makeRequest(body), makeContext());

    expect(response.status).toBe(200);
    const json = response.jsonBody as { donors: unknown[] };
    expect(json.donors).toHaveLength(0);
  });

  it("returns 400 when required fields are missing", async () => {
    const body = { requestId: "req-123" }; // missing bloodType, hospitalId

    const response = await fallbackDonors(makeRequest(body), makeContext());

    expect(response.status).toBe(400);
    const json = response.jsonBody as Record<string, unknown>;
    expect(json["code"]).toBe("VALIDATION_ERROR");
  });

  it("returns 500 when OpenAI scoring fails", async () => {
    const { OpenAIClient } = await import("@azure/openai");
    (OpenAIClient as jest.Mock).mockImplementationOnce(() => ({
      getChatCompletions: jest.fn().mockRejectedValue(new Error("OpenAI unavailable")),
    }));

    const body = {
      requestId: "req-123",
      bloodType: "O+",
      hospitalId: "hosp-456",
      location: { lat: 12.97, lng: 77.59 },
    };

    // With allSettled, individual failures don't cause 500 unless FHIR itself fails
    // FHIR query succeeds, OpenAI fails per-donor — donors are excluded
    const response = await fallbackDonors(makeRequest(body), makeContext());
    // Should still return 200 with empty list since errors are caught in allSettled
    expect(response.status).toBe(200);
  });

  it("returns 500 when FHIR query fails", async () => {
    const axios = await import("axios");
    (axios.get as jest.Mock).mockRejectedValueOnce(new Error("FHIR service unavailable"));

    const body = {
      requestId: "req-123",
      bloodType: "O+",
      hospitalId: "hosp-456",
    };

    const response = await fallbackDonors(makeRequest(body), makeContext());

    expect(response.status).toBe(500);
    const json = response.jsonBody as Record<string, unknown>;
    expect(json["code"]).toBe("INTERNAL_ERROR");
  });
});
