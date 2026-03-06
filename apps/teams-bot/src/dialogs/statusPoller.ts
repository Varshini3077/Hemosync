/**
 * StatusPoller — polls GET /api/requests/:id/status every 3 seconds.
 *
 * On CONFIRMED: calls updateActivity to replace the results card with a
 *   confirmation card.
 * On FAILED after 5 minutes: calls updateActivity with a donor card using
 *   fallback-donors API data.
 * Cleans up the interval on completion.
 */

import { TurnContext, CardFactory } from "botbuilder";
import axios from "axios";
import type {
  BroadcastStatus,
  BloodBank,
  BroadcastResult,
  DonorScore,
} from "@hemosync/types";
import { createConfirmationCard } from "../cards/confirmationCard.js";
import { createDonorCard } from "../cards/donorCard.js";
import type { RankedBank } from "../cards/resultsCard.js";

const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_DURATION_MS = 5 * 60 * 1_000; // 5 minutes

interface RequestStatusResponse {
  status: "PENDING" | "BROADCASTING" | "CONFIRMED" | "FAILED" | "FALLBACK";
  broadcastStatus: BroadcastStatus;
  confirmedBank?: BloodBank & { distanceKm?: number };
  broadcastResult?: BroadcastResult;
}

interface FallbackDonorsResponse {
  requestId: string;
  donors: DonorScore[];
  broadcastResults: BroadcastResult[];
}

export class StatusPoller {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private startedAt: number = Date.now();

  constructor(
    private readonly context: TurnContext,
    private readonly requestId: string,
    private readonly activityId: string,
    private readonly banks: RankedBank[],
    private readonly apiBaseUrl: string
  ) {}

  start(): void {
    this.intervalId = setInterval(() => {
      void this.poll();
    }, POLL_INTERVAL_MS);
  }

  private stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async poll(): Promise<void> {
    const elapsed = Date.now() - this.startedAt;

    try {
      const response = await axios.get<RequestStatusResponse>(
        `${this.apiBaseUrl}/requests/${this.requestId}/status`
      );
      const statusData = response.data;

      if (statusData.status === "CONFIRMED") {
        await this.handleConfirmed(statusData);
        this.stop();
        return;
      }

      if (
        statusData.status === "FAILED" ||
        elapsed >= MAX_POLL_DURATION_MS
      ) {
        await this.handleFailed();
        this.stop();
        return;
      }
    } catch (err) {
      console.error("[StatusPoller] Poll error:", err);

      if (elapsed >= MAX_POLL_DURATION_MS) {
        await this.handleFailed();
        this.stop();
      }
    }
  }

  private async handleConfirmed(
    statusData: RequestStatusResponse
  ): Promise<void> {
    if (!statusData.confirmedBank || !statusData.broadcastResult) {
      return;
    }

    const confirmationCard = createConfirmationCard(
      statusData.broadcastResult,
      statusData.confirmedBank
    );

    try {
      await this.context.updateActivity({
        id: this.activityId,
        type: "message",
        attachments: [CardFactory.adaptiveCard(confirmationCard)],
      });
    } catch (err) {
      // Fallback to sending a new message if update fails
      console.warn("[StatusPoller] updateActivity failed, sending new:", err);
      await this.context.sendActivity({
        attachments: [CardFactory.adaptiveCard(confirmationCard)],
      });
    }
  }

  private async handleFailed(): Promise<void> {
    let donors: DonorScore[] = [];

    try {
      const response = await axios.post<FallbackDonorsResponse>(
        `${this.apiBaseUrl}/fallback-donors`,
        {
          requestId: this.requestId,
          bloodType: "O+", // will be resolved server-side from request record
          location: { lat: 0, lng: 0 },
        }
      );
      donors = [...response.data.donors];
    } catch (err) {
      console.error("[StatusPoller] Failed to fetch fallback donors:", err);
    }

    const donorCard = createDonorCard(donors);

    try {
      await this.context.updateActivity({
        id: this.activityId,
        type: "message",
        attachments: [CardFactory.adaptiveCard(donorCard)],
      });
    } catch (err) {
      console.warn("[StatusPoller] updateActivity failed, sending new:", err);
      await this.context.sendActivity({
        attachments: [CardFactory.adaptiveCard(donorCard)],
      });
    }
  }
}
