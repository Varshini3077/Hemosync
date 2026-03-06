/**
 * RequestDialog — ComponentDialog with waterfall steps for the full blood
 * request lifecycle:
 *   1. Show request card
 *   2. Parse submitted form data via POST /api/parse-request
 *   3. Fetch ranked banks via POST /api/ranked-banks
 *   4. Initiate broadcast via POST /api/broadcast
 *   5. Show results card and start polling for status
 *   6. On confirmation, update the card in-place via updateActivity
 */

import {
  ComponentDialog,
  WaterfallDialog,
  WaterfallStepContext,
  DialogTurnResult,
  CardFactory,
} from "botbuilder-dialogs";
import { TurnContext, Activity, ActivityTypes } from "botbuilder";
import axios from "axios";
import type {
  ParseRequestBody,
  ParseRequestResponse,
  RankedBanksBody,
  RankedBanksResponse,
  BroadcastBody,
  BroadcastResponse,
} from "@hemosync/types";
import { createRequestCard } from "../cards/requestCard.js";
import { createResultsCard, type RankedBank } from "../cards/resultsCard.js";
import { StatusPoller } from "./statusPoller.js";
import type { UserProfile } from "../bot.js";

const WATERFALL_DIALOG = "waterfallDialog";

const API_BASE_URL =
  process.env["HEMOSYNC_API_URL"] ?? "http://localhost:7071/api";

interface RequestFormData {
  type: string;
  bloodType?: string;
  component?: string;
  units?: string | number;
  urgency?: string;
  location?: string;
}

export class RequestDialog extends ComponentDialog {
  static readonly id = "requestDialog";

  constructor() {
    super(RequestDialog.id);

    this.addDialog(
      new WaterfallDialog(WATERFALL_DIALOG, [
        this.showRequestCardStep.bind(this),
        this.parseRequestStep.bind(this),
        this.fetchRankedBanksStep.bind(this),
        this.broadcastStep.bind(this),
        this.showResultsStep.bind(this),
        this.awaitConfirmationStep.bind(this),
      ])
    );

    this.initialDialogId = WATERFALL_DIALOG;
  }

  // Step 1: Show the request Adaptive Card
  private async showRequestCardStep(
    step: WaterfallStepContext
  ): Promise<DialogTurnResult> {
    // If we already have form data (from task module), skip to parse
    const initOptions = step.options as { formData?: RequestFormData } | undefined;
    if (initOptions?.formData) {
      return await step.next(initOptions.formData);
    }

    const userProfile = step.context.turnState.get<UserProfile>("userProfile");
    await step.context.sendActivity({
      attachments: [
        CardFactory.adaptiveCard(
          createRequestCard(userProfile?.officeLocation)
        ),
      ],
    });

    return await step.prompt("textPrompt", {
      prompt: "Please complete the form above to submit your request.",
    });
  }

  // Step 2: Call POST /api/parse-request
  private async parseRequestStep(
    step: WaterfallStepContext
  ): Promise<DialogTurnResult> {
    const formData = step.result as RequestFormData | string;

    // If the result is the raw form submission from the card
    const data: RequestFormData =
      typeof formData === "string" ? { type: "SUBMIT_REQUEST" } : formData;

    const userProfile = step.context.turnState.get<UserProfile>("userProfile");

    const body: ParseRequestBody = {
      message: buildMessageFromFormData(data),
      hospitalId: userProfile?.department,
    };

    let parsed: ParseRequestResponse;

    try {
      const response = await axios.post<ParseRequestResponse>(
        `${API_BASE_URL}/parse-request`,
        body
      );
      parsed = response.data;
    } catch (err) {
      await step.context.sendActivity(
        "Failed to parse your blood request. Please try again."
      );
      return await step.endDialog();
    }

    // If confidence is low, ask for clarification
    if (parsed.confidence < 0.5 && parsed.clarifications.length > 0) {
      await step.context.sendActivity(
        `I need some clarification: ${parsed.clarifications.join(", ")}`
      );
      return await step.endDialog();
    }

    return await step.next({ formData: data, parsed });
  }

  // Step 3: Fetch ranked banks via POST /api/ranked-banks
  private async fetchRankedBanksStep(
    step: WaterfallStepContext
  ): Promise<DialogTurnResult> {
    const {
      formData,
      parsed,
    } = step.result as { formData: RequestFormData; parsed: ParseRequestResponse };

    if (!parsed.bloodType || !parsed.component || !parsed.units) {
      await step.context.sendActivity(
        "Could not determine all required fields. Please try again."
      );
      return await step.endDialog();
    }

    const body: RankedBanksBody = {
      bloodType: parsed.bloodType,
      component: parsed.component,
      units: parsed.units,
      location: { lat: 0, lng: 0 }, // coordinates resolved by API from hospitalId
      limit: 5,
    };

    let rankedResponse: RankedBanksResponse;
    try {
      const response = await axios.post<RankedBanksResponse>(
        `${API_BASE_URL}/ranked-banks`,
        body
      );
      rankedResponse = response.data;
    } catch (err) {
      await step.context.sendActivity(
        "Failed to retrieve ranked blood banks. Please try again."
      );
      return await step.endDialog();
    }

    return await step.next({ formData, parsed, banks: rankedResponse.banks });
  }

  // Step 4: Initiate broadcast via POST /api/broadcast
  private async broadcastStep(
    step: WaterfallStepContext
  ): Promise<DialogTurnResult> {
    const {
      formData,
      parsed,
      banks,
    } = step.result as {
      formData: RequestFormData;
      parsed: ParseRequestResponse;
      banks: RankedBank[];
    };

    const requestId = generateRequestId();
    const bankIds = banks.map((b) => b.id);

    const body: BroadcastBody = {
      requestId,
      bankIds,
    };

    let broadcastResult: BroadcastResponse;
    try {
      const response = await axios.post<BroadcastResponse>(
        `${API_BASE_URL}/broadcast`,
        body
      );
      broadcastResult = response.data;
    } catch (err) {
      await step.context.sendActivity(
        "Failed to initiate broadcast. Please try again."
      );
      return await step.endDialog();
    }

    return await step.next({
      formData,
      parsed,
      banks,
      broadcastResult,
    });
  }

  // Step 5: Show the results card and start polling
  private async showResultsStep(
    step: WaterfallStepContext
  ): Promise<DialogTurnResult> {
    const {
      banks,
      broadcastResult,
    } = step.result as {
      formData: RequestFormData;
      parsed: ParseRequestResponse;
      banks: RankedBank[];
      broadcastResult: BroadcastResponse;
    };

    const resultsCard = createResultsCard(banks, broadcastResult.requestId);

    const activity = await step.context.sendActivity({
      attachments: [CardFactory.adaptiveCard(resultsCard)],
    });

    const activityId = activity?.id;

    if (activityId) {
      const poller = new StatusPoller(
        step.context,
        broadcastResult.requestId,
        activityId,
        banks,
        API_BASE_URL
      );
      poller.start();
    }

    return await step.next({ broadcastResult });
  }

  // Step 6: Await and handle confirmation
  private async awaitConfirmationStep(
    step: WaterfallStepContext
  ): Promise<DialogTurnResult> {
    // Polling handles card updates — this step just ends the dialog
    return await step.endDialog();
  }
}

function buildMessageFromFormData(data: RequestFormData): string {
  const units = data.units ? String(data.units) : "?";
  const blood = data.bloodType ?? "unknown blood type";
  const component = data.component ?? "";
  const urgency = data.urgency ? ` urgency: ${data.urgency}` : "";
  const location = data.location ? ` at ${data.location}` : "";
  return `Need ${units} units ${blood} ${component}${urgency}${location}`.trim();
}

function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
