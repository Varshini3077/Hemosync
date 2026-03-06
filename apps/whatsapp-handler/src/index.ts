import express from "express";
import { webhookRouter } from "./routes/webhook.js";
import { sendRouter } from "./routes/send.js";

const port = Number(process.env["PORT"] ?? 3000);

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/webhook", webhookRouter);
app.use("/send", sendRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "@hemosync/whatsapp-handler" });
});

if (process.env["NODE_ENV"] !== "test") {
  app.listen(port, () => {
    console.log(`HemoSync WhatsApp Handler listening on port ${port}`);
  });
}

export { app };
