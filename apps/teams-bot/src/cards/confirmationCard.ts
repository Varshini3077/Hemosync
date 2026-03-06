/**
 * Adaptive Card displayed when a blood bank confirms supply.
 * Shows bank details, confirmed units, and a click-to-call button.
 * Compatible with Adaptive Cards schema 1.5.
 */

import type { BroadcastResult, BloodBank } from "@hemosync/types";

export function createConfirmationCard(
  result: BroadcastResult,
  bank: BloodBank & { distanceKm?: number; respondedInSeconds?: number }
): object {
  const responseTime = result.respondedAt
    ? formatResponseTime(result.respondedAt)
    : "Unknown";

  const distance =
    bank.distanceKm != null ? `${bank.distanceKm.toFixed(1)} km away` : "";

  return {
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    type: "AdaptiveCard",
    version: "1.5",
    body: [
      {
        type: "Container",
        style: "good",
        bleed: true,
        items: [
          {
            type: "TextBlock",
            text: "✅ Blood Confirmed",
            weight: "Bolder",
            size: "ExtraLarge",
            color: "Good",
          },
          {
            type: "TextBlock",
            text: `${result.units ?? "Requested"} unit${(result.units ?? 1) !== 1 ? "s" : ""} confirmed at ${bank.name}`,
            wrap: true,
            weight: "Bolder",
            size: "Medium",
          },
        ],
      },
      {
        type: "FactSet",
        spacing: "Medium",
        facts: [
          {
            title: "Blood Bank",
            value: bank.name,
          },
          {
            title: "Address",
            value: bank.address,
          },
          ...(distance
            ? [
                {
                  title: "Distance",
                  value: distance,
                },
              ]
            : []),
          {
            title: "Units Confirmed",
            value: String(result.units ?? "As requested"),
          },
          {
            title: "Response Time",
            value: responseTime,
          },
        ],
      },
    ],
    actions: [
      {
        type: "Action.OpenUrl",
        title: "📞 Call Blood Bank Now",
        style: "positive",
        url: `tel:${bank.phone}`,
      },
      {
        type: "Action.Submit",
        title: "Find In-Hospital Donors",
        data: {
          action: "FIND_DONORS",
        },
      },
    ],
  };
}

function formatResponseTime(respondedAt: Date): string {
  const seconds = Math.round((Date.now() - new Date(respondedAt).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}
