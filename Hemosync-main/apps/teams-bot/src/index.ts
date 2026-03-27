import * as restify from "restify";
import {
  BotFrameworkAdapter,
  BotFrameworkAdapterSettings,
} from "botbuilder";
import { HemoSyncBot } from "./bot.js";

const port = process.env.PORT ?? "3978";

const adapterSettings: BotFrameworkAdapterSettings = {
  appId: process.env["MicrosoftAppId"] ?? "",
  appPassword: process.env["MicrosoftAppPassword"] ?? "",
};

const adapter = new BotFrameworkAdapter(adapterSettings);

adapter.onTurnError = async (context, error) => {
  console.error("[onTurnError] Unhandled error:", error);

  try {
    await context.sendActivity({
      attachments: [
        {
          contentType: "application/vnd.microsoft.card.adaptive",
          content: {
            $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
            type: "AdaptiveCard",
            version: "1.5",
            body: [
              {
                type: "Container",
                style: "attention",
                items: [
                  {
                    type: "TextBlock",
                    text: "An error occurred",
                    weight: "Bolder",
                    size: "Medium",
                    color: "Attention",
                  },
                  {
                    type: "TextBlock",
                    text: "We encountered an unexpected error processing your request. Please try again or contact your administrator.",
                    wrap: true,
                  },
                ],
              },
            ],
          },
        },
      ],
    });
  } catch (sendErr) {
    console.error("[onTurnError] Failed to send error card:", sendErr);
  }
};

const bot = new HemoSyncBot();

const server = restify.createServer({ name: "HemoSync Teams Bot" });
server.use(restify.plugins.bodyParser());

server.post("/api/messages", async (req, res) => {
  await adapter.processActivity(req as never, res as never, async (context) => {
    await bot.run(context);
  });
});

server.listen(port, () => {
  console.log(`HemoSync Teams Bot listening on port ${port}`);
  console.log(`Bot endpoint: http://localhost:${port}/api/messages`);
});

export { server, adapter };
