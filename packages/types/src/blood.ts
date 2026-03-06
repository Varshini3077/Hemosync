/**
 * All blood-related domain types for HemoSync.
 * These are pure TypeScript interfaces — no runtime code.
 */

/** The ABO + Rh blood group system types supported by the platform. */
export type BloodType =
  | "A+"
  | "A-"
  | "B+"
  | "B-"
  | "AB+"
  | "AB-"
  | "O+"
  | "O-";

/** Transfusable blood product components. */
export type BloodComponent =
  | "PRBC"
  | "FFP"
  | "PLATELETS"
  | "CRYOPRECIPITATE"
  | "WHOLE_BLOOD";

/** Geographic coordinate plus a human-readable address. */
export interface GeoLocation {
  readonly lat: number;
  readonly lng: number;
  readonly address: string;
}

/**
 * A blood request raised by a hospital coordinator via any supported
 * interface (Teams, WhatsApp, or Web). Tracks the full lifecycle from
 * initial PENDING state through to CONFIRMED or FAILED.
 */
export interface BloodRequest {
  /** Unique identifier for the request (UUID). */
  readonly id: string;
  /** ID of the hospital originating the request. */
  readonly hospitalId: string;
  /** ID of the coordinator who raised the request. */
  readonly coordinatorId: string;
  /** Required blood type. */
  readonly bloodType: BloodType;
  /** Required blood product component. */
  readonly component: BloodComponent;
  /** Number of units required. */
  readonly units: number;
  /** Clinical urgency level driving broadcast priority. */
  readonly urgency: "CRITICAL" | "HIGH" | "NORMAL";
  /** Physical location of the requesting hospital. */
  readonly location: GeoLocation;
  /**
   * Lifecycle status of the request:
   * - PENDING: received but not yet broadcast
   * - BROADCASTING: actively contacting blood banks
   * - CONFIRMED: at least one bank has committed supply
   * - FAILED: no banks responded within the timeout
   * - FALLBACK: escalated to on-call donor matching
   */
  readonly status:
    | "PENDING"
    | "BROADCASTING"
    | "CONFIRMED"
    | "FAILED"
    | "FALLBACK";
  /** Channel through which the request was submitted. */
  readonly interface: "TEAMS" | "WHATSAPP" | "WEB";
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * A registered blood bank in the HemoSync network.
 * Reliability score is derived from historical response rates.
 */
export interface BloodBank {
  /** Unique identifier (UUID). */
  readonly id: string;
  /** Official name of the blood bank. */
  readonly name: string;
  /** Contact phone number (E.164 format). */
  readonly phone: string;
  /** Street address. */
  readonly address: string;
  /** Geographic coordinates (no address needed here — see GeoLocation). */
  readonly location: {
    readonly lat: number;
    readonly lng: number;
  };
  /**
   * Historical reliability score between 0 and 1.
   * 1.0 = always responds with available stock.
   * 0.0 = never responds or always declines.
   */
  readonly reliabilityScore: number;
  readonly lastUpdated: Date;
  /** Whether this bank is currently active in the broadcast pool. */
  readonly isActive: boolean;
}

/**
 * The outcome of a single blood bank's response to a broadcast message.
 * Captured after the bank responds (or times out).
 */
export interface BroadcastResult {
  /** ID of the responding blood bank. */
  readonly bankId: string;
  readonly bankName: string;
  /**
   * Normalised reply:
   * - YES: bank confirms it can supply
   * - NO: bank declines
   * - CHECK: bank is verifying stock — treated as pending until timeout
   * - TIMEOUT: no reply received within the broadcast window
   */
  readonly reply: "YES" | "NO" | "CHECK" | "TIMEOUT";
  /** Units the bank offered (only present when reply === 'YES'). */
  readonly units?: number;
  /** Timestamp when the bank's reply was received. */
  readonly respondedAt?: Date;
}
