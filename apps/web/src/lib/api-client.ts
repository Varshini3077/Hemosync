import axios from "axios";
import type {
  ParseRequestBody,
  ParseRequestResponse,
  RankedBanksBody,
  RankedBanksResponse,
  BroadcastBody,
  BroadcastResponse,
  FallbackDonorsBody,
  FallbackDonorsResponse,
  EmbedTokenResponse,
} from "@hemosync/types";

const client = axios.create({
  baseURL: import.meta.env["VITE_API_BASE_URL"] ?? "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

client.interceptors.request.use((config) => {
  const apiKey = import.meta.env["VITE_API_KEY"];
  if (apiKey) {
    config.headers["x-api-key"] = apiKey;
  }
  return config;
});

export async function parseRequest(
  body: ParseRequestBody,
): Promise<ParseRequestResponse> {
  const response = await client.post<ParseRequestResponse>(
    "/parse-request",
    body,
  );
  return response.data;
}

export async function getRankedBanks(
  body: RankedBanksBody,
): Promise<RankedBanksResponse> {
  const response = await client.post<RankedBanksResponse>(
    "/ranked-banks",
    body,
  );
  return response.data;
}

export async function triggerBroadcast(
  body: BroadcastBody,
): Promise<BroadcastResponse> {
  const response = await client.post<BroadcastResponse>("/broadcast", body);
  return response.data;
}

export async function getFallbackDonors(
  body: FallbackDonorsBody,
): Promise<FallbackDonorsResponse> {
  const response = await client.post<FallbackDonorsResponse>(
    "/fallback-donors",
    body,
  );
  return response.data;
}

export async function getEmbedToken(): Promise<EmbedTokenResponse> {
  const response = await client.get<EmbedTokenResponse>("/embed-token");
  return response.data;
}

export async function speechToText(audioBlob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append("audio", audioBlob, "recording.wav");

  const response = await client.post<{ transcript: string }>(
    "/speech-to-text",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    },
  );
  return response.data.transcript;
}

export interface RequestStatusResponse {
  readonly id: string;
  readonly status: "PENDING" | "BROADCASTING" | "CONFIRMED" | "FAILED" | "FALLBACK";
  readonly banks: ReadonlyArray<{
    readonly bankId: string;
    readonly bankName: string;
    readonly reply: "YES" | "NO" | "CHECK" | "TIMEOUT" | "PENDING";
  }>;
  readonly confirmedBank?: {
    readonly id: string;
    readonly name: string;
    readonly address: string;
    readonly phone: string;
    readonly distanceKm: number;
    readonly location: { readonly lat: number; readonly lng: number };
  };
  readonly broadcastStartedAt?: string;
}

export async function getRequestStatus(
  requestId: string,
): Promise<RequestStatusResponse> {
  const response = await client.get<RequestStatusResponse>(
    `/requests/${requestId}/status`,
  );
  return response.data;
}
