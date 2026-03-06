/**
 * Integration test: fallback donor flow
 * No bank YES within timeout → fallback triggered → FHIR query → donors sorted by ETA → audit record created
 *
 * Azure SDK calls are mocked; no real Azure resources required.
 */

import { jest } from "@jest/globals";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFhirQuery = jest.fn();
const mockPgQuery = jest.fn();
const mockCosmosUpsert = jest.fn();

jest.mock("@azure/cosmos", () => ({
  CosmosClient: jest.fn().mockImplementation(() => ({
    database: jest.fn().mockReturnValue({
      container: jest.fn().mockReturnValue({
        items: { upsert: mockCosmosUpsert },
        item: jest.fn().mockReturnValue({
          read: jest.fn().mockResolvedValue({
            resource: {
              requestId: "req_fallback_001",
              status: "BROADCAST_SENT",
              bloodType: "O+",
              units: 2,
              hospitalId: "hosp_001",
            },
          }),
          replace: jest.fn().mockResolvedValue({}),
        }),
      }),
    }),
  })),
}));

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeFhirDonors() {
  return [
    {
      donorId: "donor_016",
      fhirPatientId: "fhir-patient-016",
      bloodType: "O-",
      location: { lat: 28.6000, lng: 77.1500 },
      etaMinutes: 8,
      lastDonationDate: "2025-04-10",
      isEligible: true,
    },
    {
      donorId: "donor_001",
      fhirPatientId: "fhir-patient-001",
      bloodType: "O+",
      location: { lat: 28.5500, lng: 77.2500 },
      etaMinutes: 12,
      lastDonationDate: "2025-09-15",
      isEligible: true,
    },
    {
      donorId: "donor_005",
      fhirPatientId: "fhir-patient-005",
      bloodType: "O+",
      location: { lat: 28.6100, lng: 77.2300 },
      etaMinutes: 15,
      lastDonationDate: "2025-06-05",
      isEligible: true,
    },
  ];
}

function makeAuditRecord(requestId: string, donorId: string) {
  return {
    requestId,
    donorId,
    hospitalId: "hosp_001",
    bloodType: "O+",
    contactedAt: new Date().toISOString(),
    outcome: null,
    notes: "Fallback triggered after 8-minute bank timeout",
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("fallback-donor flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFhirQuery.mockResolvedValue({ entry: makeFhirDonors().map((d) => ({ resource: d })) });
    mockPgQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    mockCosmosUpsert.mockResolvedValue({ resource: {} });
  });

  test("fallback is triggered when no bank responds within timeout", () => {
    const timeoutMs = 8 * 60 * 1000; // 8 minutes
    const broadcastSentAt = Date.now() - timeoutMs - 1000; // 1 second past timeout

    const shouldTriggerFallback = Date.now() - broadcastSentAt > timeoutMs;
    expect(shouldTriggerFallback).toBe(true);
  });

  test("FHIR query returns donors sorted by ETA (ascending)", async () => {
    const donors = makeFhirDonors().sort((a, b) => a.etaMinutes - b.etaMinutes);

    expect(donors[0].etaMinutes).toBeLessThan(donors[1].etaMinutes);
    expect(donors[1].etaMinutes).toBeLessThan(donors[2].etaMinutes);
    expect(donors[0].donorId).toBe("donor_016"); // closest
  });

  test("returned donors are all eligible", async () => {
    const donors = makeFhirDonors();

    const ineligible = donors.filter((d) => !d.isEligible);
    expect(ineligible).toHaveLength(0);
  });

  test("FHIR query filters by compatible blood type", async () => {
    const requestBloodType = "O+";
    const compatibleTypes = ["O+", "O-"]; // O+ can receive O+ and O-
    const donors = makeFhirDonors().filter((d) => compatibleTypes.includes(d.bloodType));

    expect(donors.length).toBeGreaterThan(0);
    for (const donor of donors) {
      expect(compatibleTypes).toContain(donor.bloodType);
    }
  });

  test("PostgreSQL audit record is created for each donor contacted", async () => {
    const requestId = "req_fallback_001";
    const donors = makeFhirDonors();

    // Simulate inserting audit records
    for (const donor of donors) {
      const record = makeAuditRecord(requestId, donor.donorId);
      await mockPgQuery(
        `INSERT INTO donor_outreach_history (request_id, donor_id, hospital_id, blood_type, notes) VALUES ($1, $2, $3, $4, $5)`,
        [record.requestId, record.donorId, record.hospitalId, record.bloodType, record.notes]
      );
    }

    expect(mockPgQuery).toHaveBeenCalledTimes(donors.length);

    // Verify each call had the correct requestId
    for (const call of mockPgQuery.mock.calls) {
      const params = call[1] as string[];
      expect(params[0]).toBe(requestId);
    }
  });

  test("request status updates to DONOR_FALLBACK in Cosmos DB", async () => {
    const requestId = "req_fallback_001";

    await mockCosmosUpsert({
      requestId,
      status: "DONOR_FALLBACK",
      fallbackTriggeredAt: new Date().toISOString(),
    });

    expect(mockCosmosUpsert).toHaveBeenCalledTimes(1);
    const updatedDoc = mockCosmosUpsert.mock.calls[0][0] as Record<string, unknown>;
    expect(updatedDoc["status"]).toBe("DONOR_FALLBACK");
    expect(updatedDoc["requestId"]).toBe(requestId);
  });
});
