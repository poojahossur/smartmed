import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import twilio from "twilio";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Twilio Client
  const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN 
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Smart Medicine Assistant API is running" });
  });

  // Real SMS/Call Reminders
  app.post("/api/reminders/send", async (req, res) => {
    const { type, recipient, message } = req.body;

    if (!twilioClient) {
      console.warn("Twilio not configured. Simulated send.");
      return res.json({ status: "Simulated", message: "Twilio credentials missing" });
    }

    try {
      const results = [];
      if (type === 'CALL' || type === 'BOTH') {
        const call = await twilioClient.calls.create({
          twiml: `<Response><Say>${message}</Say></Response>`,
          to: recipient,
          from: process.env.TWILIO_PHONE_NUMBER!,
        });
        results.push({ type: 'CALL', sid: call.sid });
      }
      
      if (type === 'SMS' || type === 'BOTH') {
        const sms = await twilioClient.messages.create({
          body: message,
          to: recipient,
          from: process.env.TWILIO_PHONE_NUMBER!,
        });
        results.push({ type: 'SMS', sid: sms.sid });
      }
      res.json({ status: "Sent", message: "Real reminder triggered via Twilio", results });
    } catch (error) {
      console.error("Twilio error:", error);
      res.status(500).json({ status: "Error", error: String(error) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
