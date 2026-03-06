/**
 * @hemosync/types — public surface area.
 * Re-exports all shared interfaces and type aliases used across the monorepo.
 */

export type {
  BloodType,
  BloodComponent,
  GeoLocation,
  BloodRequest,
  BloodBank,
  BroadcastResult,
} from "./blood.js";

export type {
  Donor,
  DonorScore,
  FHIRExtension,
  FHIRPatient,
} from "./donor.js";

export type {
  BroadcastJob,
  BankReply,
  BroadcastStatus,
} from "./broadcast.js";

export type {
  ParseRequestBody,
  ParseRequestResponse,
  RankedBanksBody,
  RankedBanksResponse,
  BroadcastBody,
  BroadcastResponse,
  SmsWebhookBody,
  SmsWebhookResponse,
  FallbackDonorsBody,
  FallbackDonorsResponse,
  EmbedTokenResponse,
} from "./api.js";
