/**
 * Request/response shapes for all HemoSync Azure Function API endpoints.
 *
 * Endpoints:
 *  1. POST /api/parse-request         — NLP parse of a natural language blood request
 *  2. POST /api/ranked-banks          — Returns blood banks ranked by suitability
 *  3. POST /api/broadcast             — Initiates a broadcast job to blood banks
 *  4. POST /api/sms-webhook           — Inbound SMS/WhatsApp reply handler
 *  5. POST /api/fallback-donors       — Fallback living-donor search
 *  6. GET  /api/embed-token           — Power BI embed token for the dashboard
 */

import type { BloodType, BloodComponent, BloodBank, BroadcastResult } from "./blood.js";
import type { DonorScore } from "./donor.js";
import type { BroadcastStatus } from "./broadcast.js";

// ---------------------------------------------------------------------------
// 1. POST /api/parse-request
// ---------------------------------------------------------------------------

/**
 * Raw natural-language message submitted by a coordinator (e.g. from Teams
 * or WhatsApp) that needs to be parsed into a structured blood request.
 */
export interface ParseRequestBody {
  /** The raw message text to parse. */
  readonly message: string;
  /** Optional coordinator ID to associate with the parsed request. */
  readonly coordinatorId?: string;
  /** Optional hospital ID context to assist parsing. */
  readonly hospitalId?: string;
}

/**
 * Structured output of the NLP parse operation.
 * Confidence is between 0 and 1; below a threshold the coordinator is prompted
 * to confirm before proceeding.
 */
export interface ParseRequestResponse {
  readonly bloodType: BloodType | null;
  readonly component: BloodComponent | null;
  readonly units: number | null;
  readonly urgency: "CRITICAL" | "HIGH" | "NORMAL" | null;
  /** Parser confidence score (0–1). Low scores trigger a confirmation prompt. */
  readonly confidence: number;
  /** Any clarification questions the system needs answered before proceeding. */
  readonly clarifications: readonly string[];
}

// ---------------------------------------------------------------------------
// 2. POST /api/ranked-banks
// ---------------------------------------------------------------------------

/**
 * Input parameters for the blood bank ranking algorithm.
 */
export interface RankedBanksBody {
  readonly bloodType: BloodType;
  readonly component: BloodComponent;
  readonly units: number;
  readonly location: {
    readonly lat: number;
    readonly lng: number;
  };
  /** Maximum number of banks to return (default: 5). */
  readonly limit?: number;
}

/**
 * Ordered list of blood banks recommended for broadcast, with routing metadata.
 */
export interface RankedBanksResponse {
  readonly banks: readonly (BloodBank & {
    readonly distanceKm: number;
    readonly estimatedDriveMinutes: number;
    readonly compositeScore: number;
  })[];
}

// ---------------------------------------------------------------------------
// 3. POST /api/broadcast
// ---------------------------------------------------------------------------

/**
 * Triggers a broadcast job for a confirmed blood request.
 */
export interface BroadcastBody {
  readonly requestId: string;
  /** IDs of the banks to include (must have been returned by ranked-banks). */
  readonly bankIds: readonly string[];
  /** Override the default timeout in milliseconds. */
  readonly timeoutMs?: number;
}

/**
 * Immediate acknowledgement of the broadcast job creation.
 * Clients poll BroadcastStatus or subscribe via WebSocket for live updates.
 */
export interface BroadcastResponse {
  readonly broadcastId: string;
  readonly requestId: string;
  readonly status: BroadcastStatus;
}

// ---------------------------------------------------------------------------
// 4. POST /api/sms-webhook
// ---------------------------------------------------------------------------

/**
 * Inbound webhook payload from the SMS/WhatsApp provider (e.g. Twilio / Azure
 * Communication Services) when a blood bank replies to a broadcast.
 */
export interface SmsWebhookBody {
  /** Phone number the reply was received from (E.164 format). */
  readonly from: string;
  /** Phone number the original broadcast was sent to. */
  readonly to: string;
  /** Raw message body from the blood bank. */
  readonly body: string;
  /** Provider-assigned message SID for deduplication. */
  readonly messageSid: string;
  /** ISO timestamp from the provider. */
  readonly timestamp: string;
}

/**
 * Acknowledgement returned to the webhook provider after processing the reply.
 */
export interface SmsWebhookResponse {
  readonly processed: boolean;
  /** The request ID the reply was matched to (null if unmatched). */
  readonly requestId: string | null;
  /** The bank ID matched by phone number (null if unrecognised sender). */
  readonly bankId: string | null;
  readonly normalisedReply: "YES" | "NO" | "CHECK" | null;
}

// ---------------------------------------------------------------------------
// 5. POST /api/fallback-donors
// ---------------------------------------------------------------------------

/**
 * Triggers a search for eligible living donors as a fallback when no blood
 * bank can fulfil the request within the broadcast timeout.
 */
export interface FallbackDonorsBody {
  readonly requestId: string;
  readonly bloodType: BloodType;
  readonly location: {
    readonly lat: number;
    readonly lng: number;
  };
  readonly radiusKm?: number;
  readonly limit?: number;
}

/**
 * Ranked list of eligible donors for the fallback scenario, together with
 * the broadcast results that led to escalation.
 */
export interface FallbackDonorsResponse {
  readonly requestId: string;
  readonly donors: readonly DonorScore[];
  readonly broadcastResults: readonly BroadcastResult[];
}

// ---------------------------------------------------------------------------
// 6. GET /api/embed-token
// ---------------------------------------------------------------------------

/**
 * Response containing an Azure Power BI embed token for the analytics
 * dashboard embedded in the web app.
 */
export interface EmbedTokenResponse {
  /** Short-lived Power BI embed token. */
  readonly token: string;
  /** Unix timestamp (ms) when the token expires. */
  readonly expiry: number;
  /** Embed URL for the Power BI report. */
  readonly embedUrl: string;
  readonly reportId: string;
  readonly datasetId: string;
}
