/**
 * Adaptive Card displayed when no blood banks confirm and fallback donors
 * are found in-hospital.
 * Compatible with Adaptive Cards schema 1.5.
 */

import type { DonorScore } from "@hemosync/types";

const BLOOD_TYPE_COLORS: Record<string, string> = {
  "A+": "Accent",
  "A-": "Accent",
  "B+": "Warning",
  "B-": "Warning",
  "AB+": "Attention",
  "AB-": "Attention",
  "O+": "Good",
  "O-": "Good",
};

export function createDonorCard(donors: DonorScore[]): object {
  const displayDonors = donors.slice(0, 5);

  const donorRows = displayDonors.map((ds, index) =>
    buildDonorRow(ds, index)
  );

  return {
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    type: "AdaptiveCard",
    version: "1.5",
    body: [
      {
        type: "Container",
        style: "attention",
        bleed: true,
        items: [
          {
            type: "TextBlock",
            text: "No Banks Confirmed — In-Hospital Donors Found",
            weight: "Bolder",
            size: "Medium",
            color: "Attention",
            wrap: true,
          },
          {
            type: "TextBlock",
            text: "Contact the following eligible donors immediately:",
            wrap: true,
            isSubtle: true,
          },
        ],
      },
      {
        type: "Container",
        spacing: "Medium",
        items: [
          {
            type: "ColumnSet",
            columns: [
              {
                type: "Column",
                width: "40px",
                items: [
                  {
                    type: "TextBlock",
                    text: "Type",
                    weight: "Bolder",
                    size: "Small",
                    isSubtle: true,
                  },
                ],
              },
              {
                type: "Column",
                width: "30px",
                items: [
                  {
                    type: "TextBlock",
                    text: "OK",
                    weight: "Bolder",
                    size: "Small",
                    isSubtle: true,
                  },
                ],
              },
              {
                type: "Column",
                width: "stretch",
                items: [
                  {
                    type: "TextBlock",
                    text: "Eligibility",
                    weight: "Bolder",
                    size: "Small",
                    isSubtle: true,
                  },
                ],
              },
              {
                type: "Column",
                width: "50px",
                items: [
                  {
                    type: "TextBlock",
                    text: "ETA",
                    weight: "Bolder",
                    size: "Small",
                    isSubtle: true,
                  },
                ],
              },
              {
                type: "Column",
                width: "60px",
                items: [
                  {
                    type: "TextBlock",
                    text: "Contact",
                    weight: "Bolder",
                    size: "Small",
                    isSubtle: true,
                  },
                ],
              },
            ],
          },
          ...donorRows.flat(),
        ],
      },
    ],
  };
}

function buildDonorRow(ds: DonorScore, index: number): object[] {
  const { donor, etaMinutes, eligibilityReason } = ds;
  const color = BLOOD_TYPE_COLORS[donor.bloodType] ?? "Default";

  return [
    {
      type: "ColumnSet",
      spacing: index === 0 ? "Small" : "None",
      separator: index !== 0,
      columns: [
        {
          type: "Column",
          width: "40px",
          items: [
            {
              type: "TextBlock",
              text: donor.bloodType,
              weight: "Bolder",
              color,
              size: "Small",
            },
          ],
        },
        {
          type: "Column",
          width: "30px",
          items: [
            {
              type: "TextBlock",
              text: donor.isEligible ? "✔" : "✖",
              color: donor.isEligible ? "Good" : "Attention",
              size: "Small",
            },
          ],
        },
        {
          type: "Column",
          width: "stretch",
          items: [
            {
              type: "TextBlock",
              text: eligibilityReason,
              wrap: true,
              size: "Small",
            },
          ],
        },
        {
          type: "Column",
          width: "50px",
          items: [
            {
              type: "TextBlock",
              text: `${etaMinutes} min`,
              size: "Small",
              isSubtle: true,
            },
          ],
        },
        {
          type: "Column",
          width: "60px",
          items: [
            {
              type: "ActionSet",
              actions: [
                {
                  type: "Action.OpenUrl",
                  title: "Call",
                  url: `tel:${donor.phone}`,
                },
              ],
            },
          ],
        },
      ],
    },
  ];
}
