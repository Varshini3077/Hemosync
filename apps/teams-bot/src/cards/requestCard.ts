/**
 * Adaptive Card for submitting a blood request.
 * Compatible with Adaptive Cards schema 1.5.
 */

export function createRequestCard(prefillLocation?: string): object {
  return {
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    type: "AdaptiveCard",
    version: "1.5",
    body: [
      {
        type: "TextBlock",
        text: "New Blood Request",
        weight: "Bolder",
        size: "Large",
        color: "Attention",
      },
      {
        type: "TextBlock",
        text: "Fill in the details below to broadcast a blood request to nearby banks.",
        wrap: true,
        spacing: "Small",
        isSubtle: true,
      },
      {
        type: "ColumnSet",
        columns: [
          {
            type: "Column",
            width: "stretch",
            items: [
              {
                type: "TextBlock",
                text: "Blood Type",
                weight: "Bolder",
              },
              {
                type: "Input.ChoiceSet",
                id: "bloodType",
                style: "compact",
                isRequired: true,
                errorMessage: "Please select a blood type",
                placeholder: "Select blood type",
                choices: [
                  { title: "A+", value: "A+" },
                  { title: "A-", value: "A-" },
                  { title: "B+", value: "B+" },
                  { title: "B-", value: "B-" },
                  { title: "AB+", value: "AB+" },
                  { title: "AB-", value: "AB-" },
                  { title: "O+", value: "O+" },
                  { title: "O-", value: "O-" },
                ],
              },
            ],
          },
          {
            type: "Column",
            width: "stretch",
            items: [
              {
                type: "TextBlock",
                text: "Component",
                weight: "Bolder",
              },
              {
                type: "Input.ChoiceSet",
                id: "component",
                style: "compact",
                isRequired: true,
                errorMessage: "Please select a component",
                placeholder: "Select component",
                choices: [
                  { title: "Packed Red Blood Cells (PRBC)", value: "PRBC" },
                  { title: "Fresh Frozen Plasma (FFP)", value: "FFP" },
                  { title: "Platelets", value: "PLATELETS" },
                  { title: "Cryoprecipitate", value: "CRYOPRECIPITATE" },
                  { title: "Whole Blood", value: "WHOLE_BLOOD" },
                ],
              },
            ],
          },
        ],
      },
      {
        type: "ColumnSet",
        columns: [
          {
            type: "Column",
            width: "stretch",
            items: [
              {
                type: "TextBlock",
                text: "Units Required (1-10)",
                weight: "Bolder",
              },
              {
                type: "Input.Number",
                id: "units",
                placeholder: "Enter units",
                min: 1,
                max: 10,
                isRequired: true,
                errorMessage: "Please enter a value between 1 and 10",
              },
            ],
          },
          {
            type: "Column",
            width: "stretch",
            items: [
              {
                type: "TextBlock",
                text: "Urgency",
                weight: "Bolder",
              },
              {
                type: "Input.ChoiceSet",
                id: "urgency",
                style: "expanded",
                isRequired: true,
                errorMessage: "Please select urgency level",
                choices: [
                  {
                    title: "CRITICAL — immediate life threat",
                    value: "CRITICAL",
                  },
                  {
                    title: "HIGH — surgery / acute loss",
                    value: "HIGH",
                  },
                  {
                    title: "NORMAL — scheduled transfusion",
                    value: "NORMAL",
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        type: "TextBlock",
        text: "Hospital / Location",
        weight: "Bolder",
        spacing: "Medium",
      },
      {
        type: "Input.Text",
        id: "location",
        placeholder: "Enter hospital name or ward",
        value: prefillLocation ?? "",
      },
    ],
    actions: [
      {
        type: "Action.Submit",
        title: "Submit Request",
        style: "positive",
        data: {
          type: "SUBMIT_REQUEST",
        },
      },
    ],
  };
}
