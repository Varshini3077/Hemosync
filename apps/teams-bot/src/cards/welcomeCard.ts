/**
 * Welcome Adaptive Card shown to new members who join a conversation.
 * Compatible with Adaptive Cards schema 1.5.
 */

export function createWelcomeCard(): object {
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
            text: "🩸 HemoSync",
            weight: "Bolder",
            size: "ExtraLarge",
          },
          {
            type: "TextBlock",
            text: "Emergency Blood Coordination",
            isSubtle: true,
            size: "Medium",
          },
        ],
      },
      {
        type: "TextBlock",
        text: "Welcome to HemoSync — your emergency blood coordination assistant. Use this bot to instantly broadcast blood requests to nearby banks.",
        wrap: true,
        spacing: "Medium",
      },
      {
        type: "TextBlock",
        text: "What I can do:",
        weight: "Bolder",
        spacing: "Medium",
      },
      {
        type: "TextBlock",
        text: "• Submit blood requests to nearby banks\n• Track broadcast status in real time\n• Alert you when a bank confirms supply\n• Find in-hospital donors as a fallback",
        wrap: true,
      },
    ],
    actions: [
      {
        type: "Action.Submit",
        title: "New Blood Request",
        style: "positive",
        data: {
          type: "OPEN_REQUEST_FORM",
        },
      },
    ],
  };
}
