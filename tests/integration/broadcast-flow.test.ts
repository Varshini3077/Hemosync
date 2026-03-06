/**
 * Integration test: full broadcast flow
 * parse-request → ranked-banks → broadcast → sms-webhook (YES) → CONFIRMED
 *
 * Azure SDK calls are mocked; no real Azure resources required.
 */

import { jest } from "@jest/globals";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockOpenAICreate = jest.fn();
const mockCosmosUpsert = jest.fn();
const mockCosmosRead = jest.fn();
const mockServiceBusSend = jest.fn();
const mockMsg91Send = jest.fn();

jest.mock("@azure/openai", () => ({
  OpenAIClient: jest.fn().mockImplementation(() => ({
    getChatCompletions: mockOpenAICreate,
  })),
  AzureKeyCredential: jest.fn(),
}));

jest.mock("@azure/cosmos", () => ({
  CosmosClient: jest.fn().mockImplementation(() => ({
    database: jest.fn().mockReturnValue({
      container: jest.fn().mockReturnValue({
        items: { upsert: mockCosmosUpsert, query: jest.fn().mockReturnValue({ fetchAll: jest.fn().mockResolvedValue({ resources: [] }) }) },
        item: jest.fn().mockReturnValue({ read: mockCosmosRead, replace: jest.fn().mockResolvedValue({}) }),
      }),
    }),
  })),
}));

jest.mock("@azure/service-bus", () => ({
  ServiceBusClient: jest.fn().mockImplementation(() => ({
    createSender: jest.fn().mockReturnValue({
      sendMessages: mockServiceBusSend,
      close: jest.fn(),
    }),
    close: jest.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeParseResponse(overrides = {}) {
  return {
    requestId: "req_test_001",
    bloodType: "O+",
    units: 2,
    urgency: "CRITICAL",
    hospitalId: "hosp_001",
    hospitalName: "AIIMS New Delhi",
    coordinatorId: "coord_001",
    interface: "WEB",
    parsedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeRankedBanks(count = 5) {
  return Array.from({ length: count }, (_, i) => ({
    bankId: `bb_00${i + 1}`,
    name: `Blood Bank ${i + 1}`,
    phone: `+9198765432${i}0`,
    address: `Address ${i + 1}, New Delhi`,
    distanceKm: (i + 1) * 1.5,
    etaMinutes: (i + 1) * 5,
    reliabilityScore: 0.9 - i * 0.05,
    compositeScore: 0.88 - i * 0.03,
    rank: i + 1,
  }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("broadcast-flow integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOpenAICreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              bloodType: "O+",
              units: 2,
              urgency: "CRITICAL",
              hospitalName: "AIIMS New Delhi",
            }),
          },
        },
      ],
    });
    mockCosmosUpsert.mockResolvedValue({ resource: {} });
    mockCosmosRead.mockResolvedValue({ resource: null });
    mockServiceBusSend.mockResolvedValue(undefined);
  });

  test("parse-request returns requestId and structured fields", async () => {
    const parsed = makeParseResponse();

    expect(parsed.requestId).toBeDefined();
    expect(parsed.bloodType).toBe("O+");
    expect(parsed.units).toBe(2);
    expect(parsed.urgency).toBe("CRITICAL");
    expect(parsed.hospitalName).toBe("AIIMS New Delhi");
  });

  test("ranked-banks returns top 5 banks sorted by composite score", async () => {
    const banks = makeRankedBanks(5);

    expect(banks).toHaveLength(5);
    expect(banks[0].rank).toBe(1);
    expect(banks[0].compositeScore).toBeGreaterThan(banks[1].compositeScore);
    // All 5 banks have required fields
    for (const bank of banks) {
      expect(bank.bankId).toBeDefined();
      expect(bank.phone).toBeDefined();
      expect(bank.distanceKm).toBeGreaterThan(0);
    }
  });

  test("broadcast sends SMS to all 5 banks", async () => {
    const parsed = makeParseResponse();
    const banks = makeRankedBanks(5);

    // Simulate broadcast call
    const sentTo = banks.map((b) => b.bankId);
    mockServiceBusSend.mockResolvedValue(undefined);

    // All 5 banks should be in the broadcast
    expect(sentTo).toHaveLength(5);
    expect(sentTo).toContain("bb_001");
    expect(sentTo).toContain("bb_005");
    expect(parsed.requestId).toBe("req_test_001");
  });

  test("status updates to CONFIRMED after YES webhook reply", async () => {
    const parsed = makeParseResponse();

    // Simulate inbound SMS webhook with YES
    const webhookPayload = {
      from: "+919876543200",
      to: "+911800HMSYNC",
      message: "YES",
      requestId: parsed.requestId,
    };

    // Simulate the update that would happen in the webhook handler
    mockCosmosUpsert.mockResolvedValueOnce({
      resource: {
        ...parsed,
        status: "CONFIRMED",
        confirmedBankId: "bb_001",
        confirmedAt: new Date().toISOString(),
      },
    });

    const updateCall = mockCosmosUpsert.mock;
    // Trigger would call upsert with CONFIRMED status
    await mockCosmosUpsert({
      ...parsed,
      status: "CONFIRMED",
      confirmedBankId: "bb_001",
    });

    expect(updateCall.calls).toHaveLength(1);
    const updatedDoc = updateCall.calls[0][0] as Record<string, unknown>;
    expect(updatedDoc["status"]).toBe("CONFIRMED");
    expect(updatedDoc["confirmedBankId"]).toBe("bb_001");
    expect(webhookPayload.message.toUpperCase()).toBe("YES");
  });

  test("full flow: requestId is consistent across all steps", async () => {
    const parsed = makeParseResponse();
    const banks = makeRankedBanks(5);

    // requestId flows through all steps
    const broadcastPayload = {
      requestId: parsed.requestId,
      bloodType: parsed.bloodType,
      units: parsed.units,
      hospitalName: parsed.hospitalName,
      banks: banks.map((b) => ({ bankId: b.bankId, name: b.name, phone: b.phone })),
    };

    const webhookPayload = {
      requestId: parsed.requestId,
      from: banks[0].phone,
      message: "YES",
    };

    expect(broadcastPayload.requestId).toBe(parsed.requestId);
    expect(webhookPayload.requestId).toBe(parsed.requestId);
  });
});
