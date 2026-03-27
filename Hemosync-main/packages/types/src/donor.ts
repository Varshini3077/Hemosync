/**
 * Donor-related types for HemoSync's fallback donor matching system.
 * Used when no blood bank can fulfil a request and a living donor is needed.
 */

import type { BloodType } from "./blood.js";

/**
 * A registered blood donor who has consented to be contacted in emergencies.
 * Linked optionally to a FHIR Patient resource for clinical data integration.
 */
export interface Donor {
  /** Unique identifier (UUID). */
  readonly id: string;
  readonly bloodType: BloodType;
  /** Date of most recent blood donation (ISO date string). */
  readonly lastDonationDate: string;
  /** Donor body weight in kilograms (eligibility threshold: typically ≥50 kg). */
  readonly weightKg: number;
  /**
   * Whether the donor is currently eligible to donate.
   * Computed from lastDonationDate (56-day gap), weightKg, and other criteria.
   */
  readonly isEligible: boolean;
  /** Current geographic location for ETA calculation. */
  readonly location: {
    readonly lat: number;
    readonly lng: number;
  };
  /** Contact phone number (E.164 format). */
  readonly phone: string;
  /** Hospital the donor is affiliated with (for on-site donors). */
  readonly hospitalId: string;
  /** FHIR Patient resource ID if integrated with a hospital EHR system. */
  readonly fhirPatientId?: string;
}

/**
 * A ranked donor candidate returned by the scoring algorithm.
 * Combines a donor record with computed routing and eligibility metadata.
 */
export interface DonorScore {
  readonly donor: Donor;
  /**
   * Composite score used for ranking (higher = better candidate).
   * Factors include: blood type compatibility, ETA, time since last donation.
   */
  readonly score: number;
  /** Estimated travel time to the requesting hospital in minutes. */
  readonly etaMinutes: number;
  /**
   * Human-readable explanation of the donor's eligibility status.
   * E.g. "Eligible — last donated 90 days ago" or "Ineligible — donated 20 days ago".
   */
  readonly eligibilityReason: string;
}

/** A single FHIR extension entry as used in the Patient resource. */
export interface FHIRExtension {
  readonly url: string;
  readonly valueString?: string;
  readonly valueDecimal?: number;
}

/**
 * Minimal FHIR R4 Patient resource shape used for EHR integration.
 * Only the fields HemoSync reads/writes are typed here.
 */
export interface FHIRPatient {
  readonly resourceType: "Patient";
  readonly id: string;
  /** Blood type stored as a FHIR extension (system: http://loinc.org, code: 882-1). */
  readonly bloodType: BloodType;
  /**
   * FHIR extensions array containing:
   * - last-donation-date (valueString: ISO date)
   * - weight (valueDecimal: kg)
   */
  readonly extension: readonly FHIRExtension[];
}
