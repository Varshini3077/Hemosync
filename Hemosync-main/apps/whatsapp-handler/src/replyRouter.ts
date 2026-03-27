/**
 * replyRouter — routes outbound confirmation messages back to the correct
 * coordinator's WhatsApp thread using the conversationId stored in the
 * Cosmos DB request record.
 *
 * Called internally when a blood bank confirms and the system needs to notify
 * the originating coordinator.
 */

import axios from "axios";

const ACS_SEND_URL =
  process.env["WHATSAPP_HANDLER_URL"]
    ? `${process.env["WHATSAPP_HANDLER_URL"]}/send`
    : "http://localhost:3000/send";

const COSMOS_API_URL =
  process.env["HEMOSYNC_API_URL"] ?? "http://localhost:7071/api";

export interface ConfirmationPayload {
  requestId: string;
  units: number;
  bloodType: string;
  bankName: string;
  bankPhone: string;
}

interface RequestRecord {
  id: string;
  coordinatorId: string; // phone number in E.164 format for WhatsApp
  interface: "TEAMS" | "WHATSAPP" | "WEB";
}

/**
 * Looks up the originating coordinator's phone from the request record
 * and sends a WhatsApp confirmation via the /send route.
 */
export async function routeConfirmationReply(
  payload: ConfirmationPayload
): Promise<void> {
  // Fetch request record to get coordinator phone
  let record: RequestRecord;
  try {
    const response = await axios.get<RequestRecord>(
      `${COSMOS_API_URL}/requests/${payload.requestId}`
    );
    record = response.data;
  } catch (err) {
    console.error(
      `[replyRouter] Failed to fetch request ${payload.requestId}:`,
      err
    );
    throw new Error(`Could not retrieve request record: ${payload.requestId}`);
  }

  // Only route via WhatsApp for requests submitted through WhatsApp
  if (record.interface !== "WHATSAPP") {
    console.log(
      `[replyRouter] Request ${payload.requestId} was submitted via ${record.interface}, skipping WhatsApp reply`
    );
    return;
  }

  const coordinatorPhone = record.coordinatorId;
  if (!coordinatorPhone) {
    throw new Error(
      `No coordinator phone on record for request ${payload.requestId}`
    );
  }

  try {
    await axios.post(ACS_SEND_URL, {
      to: coordinatorPhone,
      units: payload.units,
      bloodType: payload.bloodType,
      bankName: payload.bankName,
      phone: payload.bankPhone,
      requestId: payload.requestId,
    });

    console.log(
      `[replyRouter] Sent WhatsApp confirmation to ${coordinatorPhone} for request ${payload.requestId}`
    );
  } catch (err) {
    console.error("[replyRouter] Failed to send WhatsApp confirmation:", err);
    throw err;
  }
}
