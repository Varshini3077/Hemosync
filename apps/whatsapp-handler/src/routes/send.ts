/**
 * POST /send — internal route called by the sms-webhook Azure Function to
 * send a WhatsApp confirmation back to the coordinator via ACS.
 *
 * Sends a templated WhatsApp message via the ACS messaging REST client,
 * loaded dynamically to avoid a static @azure/communication-messages import.
 */

import { Router, Request, Response } from "express";
import { z } from "zod";

const ACS_CONNECTION_STRING =
  process.env["ACS_CONNECTION_STRING"] ?? "";
const ACS_CHANNEL_ID =
  process.env["ACS_WHATSAPP_CHANNEL_ID"] ?? "";

export const sendRouter: Router = Router();

const SendPayloadSchema = z.object({
  to: z.string().min(1, "Recipient phone number is required"),
  units: z.number().positive(),
  bloodType: z.string().min(1),
  bankName: z.string().min(1),
  phone: z.string().min(1),
  requestId: z.string().min(1),
});

type SendPayload = z.infer<typeof SendPayloadSchema>;

sendRouter.post("/", async (req: Request, res: Response): Promise<void> => {
  const parsed = SendPayloadSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid payload",
      details: parsed.error.flatten(),
    });
    return;
  }

  const payload = parsed.data;

  if (!ACS_CONNECTION_STRING || !ACS_CHANNEL_ID) {
    console.error("[send] ACS_CONNECTION_STRING or ACS_WHATSAPP_CHANNEL_ID not configured");
    res.status(503).json({ error: "WhatsApp messaging not configured" });
    return;
  }

  try {
    await sendConfirmationWhatsApp(payload);
    res.status(200).json({ sent: true, to: payload.to });
  } catch (err) {
    console.error("[send] Failed to send WhatsApp message:", err);
    res.status(500).json({ error: "Failed to send WhatsApp message" });
  }
});

async function sendConfirmationWhatsApp(payload: SendPayload): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { NotificationMessagesClient } = require("@azure/communication-messages") as { NotificationMessagesClient: any };
  const client: any = new NotificationMessagesClient(ACS_CONNECTION_STRING);

  const templateName = "hemosync_blood_confirmation";
  const templateLanguage = "en_US";

  // Template: "✅ Blood confirmed: {1} units {2} at {3}. Call: {4}. Req: {5}"
  const templateValues: any[] = [
    {
      name: "units",
      kind: "text",
      text: String(payload.units),
    },
    {
      name: "blood_type",
      kind: "text",
      text: payload.bloodType,
    },
    {
      name: "bank_name",
      kind: "text",
      text: payload.bankName,
    },
    {
      name: "phone",
      kind: "text",
      text: payload.phone,
    },
    {
      name: "request_id",
      kind: "text",
      text: payload.requestId,
    },
  ];

  const bindings: any = {
    kind: "whatsApp",
    body: templateValues.map((v) => ({ refValue: v.name })),
  };

  const template: any = {
    name: templateName,
    language: templateLanguage,
    bindings,
    values: templateValues,
  };

  await client.send({
    channelRegistrationId: ACS_CHANNEL_ID,
    to: [payload.to],
    kind: "template",
    template,
  });

  console.log(
    `[send] Sent WhatsApp confirmation to ${payload.to} for request ${payload.requestId}`
  );
}
