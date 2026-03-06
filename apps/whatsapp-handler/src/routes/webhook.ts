/**
 * POST /webhook/whatsapp — ACS WhatsApp inbound message webhook.
 *
 * ACS requires:
 *   - GET with challenge token for webhook validation
 *   - POST for inbound message events
 *   - Both must return 200 quickly (< 15 seconds)
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import axios from "axios";
import { parseWhatsAppMessage } from "../messageParser.js";

const API_BASE_URL =
  process.env["HEMOSYNC_API_URL"] ?? "http://localhost:7071/api";

export const webhookRouter = Router();

// ACS webhook validation — GET with challenge token
webhookRouter.get("/whatsapp", (req: Request, res: Response): void => {
  const validationToken = req.query["validationToken"];
  if (validationToken && typeof validationToken === "string") {
    // Echo back the validation token to confirm ownership
    res.status(200).send(validationToken);
    return;
  }
  res.status(200).json({ status: "ok" });
});

// ACS inbound message event handler
webhookRouter.post("/whatsapp", (req: Request, res: Response): void => {
  // Respond immediately — ACS requires a fast 200 response
  res.status(200).json({ received: true });

  // Process asynchronously without blocking the response
  void processInboundMessage(req.body as unknown);
});

const AcsEventSchema = z.object({
  eventType: z.string(),
  data: z.object({
    from: z.string(),
    message: z.object({
      content: z.string().optional(),
      kind: z.string().optional(),
    }).optional(),
    receivedTimestamp: z.string().optional(),
  }).optional(),
});

const AcsEventArraySchema = z.array(AcsEventSchema);

async function processInboundMessage(body: unknown): Promise<void> {
  try {
    // ACS sends an array of events
    const events = AcsEventArraySchema.safeParse(body);

    if (!events.success) {
      console.warn("[webhook] Unexpected payload shape:", body);
      return;
    }

    for (const event of events.data) {
      if (
        event.eventType !== "Microsoft.Communication.AdvancedMessageReceived"
      ) {
        continue;
      }

      const data = event.data;
      if (!data) continue;

      const senderPhone = data.from;
      const messageText = data.message?.content ?? "";
      const timestamp = data.receivedTimestamp ?? new Date().toISOString();

      if (!senderPhone || !messageText) {
        console.warn("[webhook] Missing phone or message content");
        continue;
      }

      const parsed = parseWhatsAppMessage(messageText);

      try {
        await axios.post(`${API_BASE_URL}/parse-request`, {
          message: messageText,
          coordinatorId: senderPhone,
          ...(parsed.hospitalId ? { hospitalId: parsed.hospitalId } : {}),
        });

        console.log(
          `[webhook] Forwarded message from ${senderPhone} at ${timestamp}`
        );
      } catch (err) {
        console.error("[webhook] Failed to forward to parse-request:", err);
      }
    }
  } catch (err) {
    console.error("[webhook] processInboundMessage error:", err);
  }
}
