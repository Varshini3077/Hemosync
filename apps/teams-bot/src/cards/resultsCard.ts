/**
 * Adaptive Card that displays ranked blood banks and broadcast status.
 * Compatible with Adaptive Cards schema 1.5.
 */

import type { BloodBank } from "@hemosync/types";

export type RankedBank = BloodBank & {
  distanceKm: number;
  estimatedDriveMinutes: number;
  compositeScore: number;
};

export function createResultsCard(banks: RankedBank[], requestId: string): object {
  const displayBanks = banks.slice(0, 5);
  const timestamp = new Date().toISOString();

  const bankRows = displayBanks.map((bank, index) => buildBankRow(bank, index));

  return {
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    type: "AdaptiveCard",
    version: "1.5",
    body: [
      {
        type: "TextBlock",
        text: "Broadcasting Blood Request",
        weight: "Bolder",
        size: "Large",
      },
      {
        type: "TextBlock",
        text: `Contacting ${displayBanks.length} nearby blood bank${displayBanks.length !== 1 ? "s" : ""}...`,
        wrap: true,
        isSubtle: true,
        spacing: "Small",
      },
      {
        type: "Container",
        spacing: "Medium",
        items: bankRows.flat(),
      },
      {
        type: "Container",
        spacing: "Medium",
        style: "emphasis",
        items: [
          {
            type: "ColumnSet",
            columns: [
              {
                type: "Column",
                width: "stretch",
                items: [
                  {
                    type: "TextBlock",
                    id: "statusText",
                    text: `Broadcasting to all ${displayBanks.length}... waiting for replies`,
                    wrap: true,
                    weight: "Bolder",
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        type: "ColumnSet",
        spacing: "Small",
        columns: [
          {
            type: "Column",
            width: "stretch",
            items: [
              {
                type: "TextBlock",
                text: `Request ID: ${requestId}`,
                isSubtle: true,
                size: "Small",
              },
            ],
          },
          {
            type: "Column",
            width: "auto",
            items: [
              {
                type: "TextBlock",
                text: formatTimestamp(timestamp),
                isSubtle: true,
                size: "Small",
              },
            ],
          },
        ],
      },
    ],
  };
}

function buildBankRow(bank: RankedBank, index: number): object[] {
  const reliabilityWidth = Math.round(bank.reliabilityScore * 100);
  const reliabilityLabel = `${reliabilityWidth}%`;

  return [
    {
      type: "ColumnSet",
      spacing: index === 0 ? "None" : "Small",
      columns: [
        {
          type: "Column",
          width: "10px",
          items: [
            {
              type: "TextBlock",
              text: `${index + 1}.`,
              weight: "Bolder",
              color: "Accent",
            },
          ],
        },
        {
          type: "Column",
          width: "stretch",
          items: [
            {
              type: "TextBlock",
              text: bank.name,
              weight: "Bolder",
              wrap: true,
            },
            {
              type: "ColumnSet",
              spacing: "Small",
              columns: [
                {
                  type: "Column",
                  width: "auto",
                  items: [
                    {
                      type: "TextBlock",
                      text: `${bank.distanceKm.toFixed(1)} km`,
                      isSubtle: true,
                      size: "Small",
                    },
                  ],
                },
                {
                  type: "Column",
                  width: "auto",
                  items: [
                    {
                      type: "TextBlock",
                      text: `~${bank.estimatedDriveMinutes} min`,
                      isSubtle: true,
                      size: "Small",
                    },
                  ],
                },
                {
                  type: "Column",
                  width: "auto",
                  items: [
                    {
                      type: "TextBlock",
                      text: bank.phone,
                      isSubtle: true,
                      size: "Small",
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: "Column",
          width: "80px",
          items: [
            {
              type: "TextBlock",
              text: `Reliability`,
              size: "Small",
              isSubtle: true,
            },
            {
              type: "TextBlock",
              text: reliabilityLabel,
              weight: "Bolder",
              color: reliabilityWidth >= 70 ? "Good" : reliabilityWidth >= 40 ? "Warning" : "Attention",
              size: "Small",
            },
          ],
        },
      ],
    },
  ];
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
