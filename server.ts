import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import twilio from "twilio";
import admin from "firebase-admin";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import fs from "fs";
import { handleHealthcareSearch } from "./server/healthcareSearch";
import { GoogleGenAI } from "@google/genai";

// Initialize Firebase Admin safely
let firebaseConfig: any = {
  projectId: "gen-lang-client-0424554270",
  firestoreDatabaseId: "ai-studio-63a4bb59-3567-4435-8c2d-00fb269cbe55",
};

try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");

  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(
      fs.readFileSync(configPath, "utf8")
    );
  }
} catch (e) {
  console.warn(
    "[Firebase Config] Using fallback configuration:",
    e
  );
}

let adminApp: any = null;

try {
  if (getApps().length === 0) {
    const serviceAccountJson =
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (serviceAccountJson) {
      // Render / production
      const serviceAccount = JSON.parse(serviceAccountJson);

      adminApp = initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: firebaseConfig.projectId,
      });

      console.log(
        "[Firebase Admin] Initialized using service account credentials"
      );
    } else {
      // Local development
      adminApp = initializeApp({
        projectId: firebaseConfig.projectId,
      });

      console.log(
        "[Firebase Admin] Initialized using local Google credentials"
      );
    }
  } else {
    adminApp = getApps()[0];
  }

  console.log(
    `[Firebase Admin] Initialized project: ${firebaseConfig.projectId}`
  );
} catch (e) {
  console.error(
    "[Firebase Admin] Initialization error:",
    e
  );
}

let fdb: any = null;

try {
  if (adminApp) {
    fdb = getFirestore(
      adminApp,
      firebaseConfig.firestoreDatabaseId
    );
  }
} catch (e) {
  console.error(
    "[Firebase Admin] Firestore init error:",
    e
  );
}

// Test Firestore connectivity asynchronously without blocking startup
if (fdb) {
  (async () => {
    try {
      console.log(
        `[Firebase Admin] Testing connectivity to database: ${firebaseConfig.firestoreDatabaseId}`
      );

      const testDoc = await fdb
        .collection("users")
        .limit(1)
        .get();

      console.log(
        `[Firebase Admin] Connectivity test result: Success. Found users: ${!testDoc.empty}`
      );
    } catch (err: any) {
      console.warn(
        `[Firebase Admin] Connectivity test notice:`,
        err?.message || err
      );
    }
  })();
}

async function startServer() {
  const app = express();

  // Use hosting provider's PORT when available
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "15mb" }));
  app.use(
    express.urlencoded({
      extended: true,
      limit: "15mb",
    })
  );

  // Twilio Client
  const twilioClient =
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN
      ? twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        )
      : null;

  const getServerHost = (req: any) => {
    let protocol =
      req.get("x-forwarded-proto") || "https";

    if (protocol.includes(",")) {
      protocol = protocol.split(",")[0].trim();
    }

    const hostName =
      req.get("x-forwarded-host") || req.get("host");

    return `${protocol}://${hostName}`;
  };

  // =========================================================
  // TWILIO VOICE CALL
  // =========================================================

  const triggerCall = async (
    recipient: string,
    medicineName: string,
    userId: string,
    doseId: string,
    host: string
  ) => {
    if (!twilioClient) {
      console.warn(
        "[Twilio] Client not configured"
      );
      return;
    }

    if (!process.env.TWILIO_PHONE_NUMBER) {
      console.error(
        "[Twilio] TWILIO_PHONE_NUMBER is missing"
      );
      return;
    }

    // This is the important change:
    // Twilio now calls our own /api/voice endpoint
    // instead of the previous Twilio Studio Flow.
    const voiceUrl =
      `${host}/api/voice` +
      `?userId=${encodeURIComponent(userId)}` +
      `&doseId=${encodeURIComponent(doseId)}` +
      `&medicineName=${encodeURIComponent(medicineName)}`;

    const statusCallback =
      `${host}/api/twilio/status-callback` +
      `?userId=${encodeURIComponent(userId)}` +
      `&doseId=${encodeURIComponent(doseId)}` +
      `&recipient=${encodeURIComponent(recipient)}` +
      `&medicineName=${encodeURIComponent(medicineName)}`;

    console.log(
      `[Twilio Call Trigger] To: ${recipient}`
    );

    console.log(
      `[Twilio Call Trigger] Voice URL: ${voiceUrl}`
    );

    return await twilioClient.calls.create({
      to: recipient,

      from: process.env.TWILIO_PHONE_NUMBER,

      url: voiceUrl,

      method: "POST",

      statusCallback,

      statusCallbackMethod: "POST",
    });
  };

  // =========================================================
  // FIRESTORE DOSE STATUS
  // =========================================================

  const updateDoseStatus = async (
    userId: string,
    doseId: string,
    status: "taken" | "pending" | "missed"
  ) => {
    if (
      !userId ||
      !doseId ||
      doseId === "test-dose"
    ) {
      return;
    }

    try {
      console.log(
        `[Firestore] Updating status: user=${userId}, dose=${doseId}, status=${status}`
      );

      const doseRef = fdb
        .collection("users")
        .doc(userId)
        .collection("doses")
        .doc(doseId);

      await doseRef.update({
        status: status,

        takenTime:
          status === "taken"
            ? new Date().toISOString()
            : FieldValue.delete(),
      });
    } catch (e) {
      console.error(
        "[Firestore Update Error]",
        e
      );
    }
  };

  // =========================================================
  // CAREGIVER NOTIFICATION
  // =========================================================

  const notifyCaregiver = async (
    userId: string,
    medicineName: string
  ) => {
    if (!twilioClient || !userId) {
      console.log(
        `[Caregiver Alert] Skipping: twilioClient=${!!twilioClient}, userId=${userId}`
      );
      return;
    }

    try {
      console.log(
        `[Caregiver Alert] Fetching profile for user: ${userId}`
      );

      const userDoc = await fdb
        .collection("users")
        .doc(userId)
        .get();

      if (!userDoc.exists) {
        console.warn(
          `[Caregiver Alert] User document not found for ${userId}`
        );
        return;
      }

      const userData = userDoc.data();

      const caregiverPhone =
        userData?.emergencyContact?.phone;

      const patientName =
        userData?.displayName || "The patient";

      if (caregiverPhone) {
        let formattedPhone =
          caregiverPhone
            .trim()
            .replace(/[^\d+]/g, "");

        if (!formattedPhone.startsWith("+")) {
          if (formattedPhone.length === 10) {
            formattedPhone = "+91" + formattedPhone;
          } else if (
            !formattedPhone.startsWith("91")
          ) {
            formattedPhone = "+" + formattedPhone;
          } else {
            formattedPhone = "+" + formattedPhone;
          }
        }

        console.log(
          `[Caregiver Alert] Sending SMS to: ${formattedPhone} for ${patientName} (med: ${medicineName})`
        );

        const fromNumber =
          process.env.TWILIO_PHONE_NUMBER;

        if (!fromNumber) {
          console.error(
            "[Caregiver Alert] TWILIO_PHONE_NUMBER is missing"
          );
          return;
        }

        const message =
          await twilioClient.messages.create({
            body: `ALERT: ${patientName} missed their medicine reminder for ${medicineName}. Please check on them.`,
            to: formattedPhone,
            from: fromNumber,
          });

        console.log(
          `[Caregiver Alert] SMS sent successfully. SID: ${message.sid}`
        );
      } else {
        console.warn(
          `[Caregiver Alert] No caregiver phone found for user ${userId} in profile.`
        );
      }
    } catch (e) {
      console.error(
        "[Caregiver Alert Error]",
        e
      );
    }
  };

  // =========================================================
  // MANUAL CAREGIVER NOTIFICATION
  // =========================================================

  app.post(
    "/api/notify-caregiver",
    async (req, res) => {
      const {
        userId,
        medicineName,
      } = req.body;

      if (!userId || !medicineName) {
        console.error(
          "[API notify-caregiver] Missing fields:",
          req.body
        );

        return res.status(400).json({
          error:
            "Missing userId or medicineName",
        });
      }

      console.log(
        `[API notify-caregiver] Triggered for user ${userId}, med: ${medicineName}`
      );

      await notifyCaregiver(
        userId,
        medicineName
      );

      res.json({
        success: true,
      });
    }
  );

  // =========================================================
  // TWILIO VOICE REMINDER
  // =========================================================

  app.post("/api/voice", (req, res) => {
    const {
      userId,
      doseId,
      medicineName,
    } = req.query;

    const twiml =
      new twilio.twiml.VoiceResponse();

    const host = getServerHost(req);

    const actionUrl =
      `${host}/api/handle-input` +
      `?userId=${encodeURIComponent(
        String(userId || "")
      )}` +
      `&doseId=${encodeURIComponent(
        String(doseId || "")
      )}` +
      `&medicineName=${encodeURIComponent(
        String(medicineName || "your medicine")
      )}`;

    console.log(
      `[Twilio Voice] Call answered. Medicine: ${medicineName}`
    );

    // Small pause after the call connects
    twiml.pause({
      length: 1,
    });

    // Main medicine reminder
    twiml.say(
      {
        voice: "alice" as any,
      },
      `Hello. This is your SmartMed medicine reminder. Please take your medicine: ${medicineName}.`
    );

    // Listen for keypad input
    const gather =
      twiml.gather({
        numDigits: 1,
        action: actionUrl,
        method: "POST",
        timeout: 6,
      });

    gather.say(
      {
        voice: "alice" as any,
      },
      "Press 1 if you have taken the medicine. Press 2 if you want to be reminded again later."
    );

    // If no key is pressed
    twiml.redirect(
      {
        method: "POST",
      },
      `${actionUrl}&retry=1`
    );

    res.type("text/xml");

    res.send(
      twiml.toString()
    );
  });

  // =========================================================
  // TWILIO DTMF HANDLER
  // =========================================================

  app.post(
    "/api/handle-input",
    async (req, res) => {
      const {
        userId,
        doseId,
        medicineName,
        retry,
      } = req.query;

      const {
        Digits,
      } = req.body;

      const twiml =
        new twilio.twiml.VoiceResponse();

      const host = getServerHost(req);

      console.log(
        `[Twilio Input] Digits: ${Digits}, Retry: ${retry}, User: ${userId}`
      );

      // User pressed 1
      if (Digits === "1") {
        twiml.say(
          {
            voice: "alice" as any,
          },
          "Thank you. Your medicine has been marked as taken. Stay healthy. Goodbye."
        );

        await updateDoseStatus(
          userId as string,
          doseId as string,
          "taken"
        );
      }

      // User pressed 2
      else if (Digits === "2") {
        twiml.say(
          {
            voice: "alice" as any,
          },
          "Okay. We will remind you again later. Goodbye."
        );
      }

      // No input - retry
      else if (
        !Digits &&
        retry === "1"
      ) {
        twiml.say(
          {
            voice: "alice" as any,
          },
          "I didn't receive any input."
        );

        twiml.say(
          {
            voice: "alice" as any,
          },
          `Please take your medicine: ${medicineName}.`
        );

        const gather =
          twiml.gather({
            numDigits: 1,
            action:
              `${host}/api/handle-input` +
              `?userId=${encodeURIComponent(
                String(userId || "")
              )}` +
              `&doseId=${encodeURIComponent(
                String(doseId || "")
              )}` +
              `&medicineName=${encodeURIComponent(
                String(
                  medicineName ||
                    "your medicine"
                )
              )}` +
              `&retry=2`,
            method: "POST",
            timeout: 6,
          });

        gather.say(
          {
            voice: "alice" as any,
          },
          "Press 1 if you have taken the medicine. Press 2 if you want to be reminded again later."
        );

        twiml.redirect(
          {
            method: "POST",
          },
          `${host}/api/handle-input` +
            `?userId=${encodeURIComponent(
              String(userId || "")
            )}` +
            `&doseId=${encodeURIComponent(
              String(doseId || "")
            )}` +
            `&medicineName=${encodeURIComponent(
              String(
                medicineName ||
                  "your medicine"
              )
            )}` +
            `&retry=2`
        );
      }

      // Invalid input / second timeout
      else {
        twiml.say(
          {
            voice: "alice" as any,
          },
          "No input received. We will notify your caregiver. Goodbye."
        );

        await updateDoseStatus(
          userId as string,
          doseId as string,
          "missed"
        );

        await notifyCaregiver(
          userId as string,
          medicineName as string
        );
      }

      res.type("text/xml");

      res.send(
        twiml.toString()
      );
    }
  );

  // =========================================================
  // GEMINI
  // =========================================================

  const gemini =
    process.env.GEMINI_API_KEY
      ? new GoogleGenAI({
          apiKey:
            process.env.GEMINI_API_KEY,
        })
      : null;

  const parseImageData = (
    imageData: string
  ) => {
    const m = String(
      imageData || ""
    ).match(
      /^data:(image\/[^;]+);base64,(.+)$/
    );

    if (!m) {
      throw new Error(
        "Invalid image data"
      );
    }

    return {
      mimeType: m[1],
      data: m[2],
    };
  };

  const parseJsonText = (
    text: string
  ) =>
    JSON.parse(
      text
        .trim()
        .replace(
          /^```json\s*/i,
          ""
        )
        .replace(
          /^```\s*/i,
          ""
        )
        .replace(
          /\s*```$/,
          ""
        )
    );

  app.post(
    "/api/ai/chat",
    async (req, res) => {
      try {
        if (!gemini) {
          return res
            .status(503)
            .json({
              error:
                "Gemini is not configured on the server.",
            });
        }

        const messages =
          Array.isArray(
            req.body?.messages
          )
            ? req.body.messages
            : [];

        const contents =
          messages
            .slice(-12)
            .map(
              (m: any) => ({
                role:
                  m.role ===
                  "assistant"
                    ? "model"
                    : "user",
                parts: [
                  {
                    text: String(
                      m.content || ""
                    ),
                  },
                ],
              })
            );

        const response =
          await gemini.models.generateContent(
            {
              model:
                "gemini-3-flash-preview",
              contents,
              config: {
                systemInstruction:
                  "You are SmartMed medical information assistant. Give general educational information, do not diagnose or prescribe, and recommend professional care for important medical decisions.",
                tools: [
                  {
                    googleSearch: {},
                  },
                ],
              },
            }
          );

        res.json({
          text:
            response.text || "",
        });
      } catch (e: any) {
        console.error(
          "[Gemini Chat]",
          e
        );

        res.status(500).json({
          error:
            e?.message ||
            "Gemini request failed",
        });
      }
    }
  );

  app.post(
    "/api/ai/analyze-medicine-image",
    async (req, res) => {
      try {
        if (!gemini) {
          return res
            .status(503)
            .json({
              error:
                "Gemini is not configured on the server.",
            });
        }

        const img =
          parseImageData(
            req.body?.imageData
          );

        const response =
          await gemini.models.generateContent(
            {
              model:
                "gemini-3-flash-preview",
              contents: [
                {
                  inlineData: img,
                },
                {
                  text:
                    "Identify the medicine in this image conservatively. Use only visible evidence and never guess. Return JSON only: medicineName, activeIngredient, strength, dosageForm, manufacturer, confidence (0 to 1), uncertainFields (array). If unclear, use an empty medicineName and low confidence.",
                },
              ],
              config: {
                responseMimeType:
                  "application/json",
              },
            }
          );

        res.json({
          result:
            parseJsonText(
              response.text ||
                "{}"
            ),
        });
      } catch (e: any) {
        console.error(
          "[Medicine Image]",
          e
        );

        res.status(500).json({
          error:
            e?.message ||
            "Medicine image analysis failed",
        });
      }
    }
  );

  app.post(
    "/api/ai/analyze-prescription",
    async (req, res) => {
      try {
        if (!gemini) {
          return res
            .status(503)
            .json({
              error:
                "Gemini is not configured on the server.",
            });
        }

        const img =
          parseImageData(
            req.body?.imageData
          );

        const prompt =
          'Read this doctor prescription, including handwriting. Extract only information that is reasonably legible. Never invent unclear medicine names or doses. Return JSON only: {"medicines":[{"medicineName":"","strength":"","dose":"","frequency":"","times":["HH:mm"],"foodInstruction":"","durationDays":number|null,"instructions":"","confidence":number,"uncertainFields":[]}]}. If a field is unclear, leave it empty and list it in uncertainFields. Convert 1-0-1 to 08:00 and 20:00 only when twice daily is clearly supported. The user will verify everything before scheduling.';

        const response =
          await gemini.models.generateContent(
            {
              model:
                "gemini-3-flash-preview",
              contents: [
                {
                  inlineData: img,
                },
                {
                  text: prompt,
                },
              ],
              config: {
                responseMimeType:
                  "application/json",
              },
            }
          );

        res.json(
          parseJsonText(
            response.text ||
              '{"medicines":[]}'
          )
        );
      } catch (e: any) {
        console.error(
          "[Prescription AI]",
          e
        );

        res.status(500).json({
          error:
            e?.message ||
            "Prescription analysis failed",
        });
      }
    }
  );

  app.post(
    "/api/ai/safer-substitution",
    async (req, res) => {
      try {
        if (!gemini) {
          return res
            .status(503)
            .json({
              error:
                "Gemini is not configured on the server.",
            });
        }

        const {
          medicineName,
          strength,
          activeIngredient,
          user,
        } = req.body || {};

        if (
          !medicineName ||
          !String(
            medicineName
          ).trim()
        ) {
          return res
            .status(400)
            .json({
              error:
                "Medicine name is required.",
            });
        }

        const prompt = `You are a conservative medication-information assistant. Review this medicine only for substitution INFORMATION, not prescribing. Medicine: ${String(medicineName).trim()}; strength: ${strength || "unknown"}; active ingredient from image analysis: ${activeIngredient || "unknown"}. Patient age: ${user?.age || "unknown"}; allergies: ${(user?.allergies || []).join(", ") || "none reported"}; chronic conditions: ${(user?.chronicConditions || []).join(", ") || "not provided"}; current medicines: ${(user?.currentMedications || []).join(", ") || "not provided"}.
Return JSON: {"alternatives":[{"name":"","reason":"","sameActiveIngredient":false,"sameStrength":false}],"safetyNote":"","riskLevel":"Low|Medium|High"}.
Rules: only include an alternative when the active ingredient/equivalence is well established from the supplied information; otherwise return an empty alternatives array. Never invent a drug. Never tell the patient to replace, stop, start, or change a prescribed medicine. State that a doctor/pharmacist must confirm any substitution.`;

        const response =
          await gemini.models.generateContent(
            {
              model:
                "gemini-3-flash-preview",
              contents: prompt,
              config: {
                responseMimeType:
                  "application/json",
              },
            }
          );

        res.json({
          result:
            parseJsonText(
              response.text ||
                '{"alternatives":[],"safetyNote":"Insufficient information.","riskLevel":"High"}'
            ),
        });
      } catch (e: any) {
        console.error(
          "[Substitution AI]",
          e
        );

        res.status(500).json({
          error:
            e?.message ||
            "Substitution analysis failed",
        });
      }
    }
  );

  app.post(
    "/api/ai/doctor-report-summary",
    async (req, res) => {
      try {
        if (!gemini) {
          return res
            .status(503)
            .json({
              error:
                "Gemini is not configured on the server.",
            });
        }

        const d =
          req.body || {};

        const response =
          await gemini.models.generateContent(
            {
              model:
                "gemini-3-flash-preview",
              contents: `Summarize these factual medication adherence statistics for a doctor. Do not diagnose, prescribe, or invent facts. Pending doses are not failures and are excluded from adherence calculations. Use the per-medicine counts exactly as supplied; do not recalculate or alter them. Period ${d.periodDays} days; scheduled ${d.scheduled}; taken ${d.taken}; missed ${d.missed}; pending ${d.pending || 0}; late ${d.late}; per medicine ${JSON.stringify(d.byMedicine || [])}. Return one concise factual paragraph that may mention the most relevant medicine-level adherence patterns only when supported by the supplied numbers.`,
            }
          );

        res.json({
          summary:
            response.text ||
            "No additional summary was generated.",
        });
      } catch (e: any) {
        console.error(
          "[Doctor Report AI]",
          e
        );

        res.status(500).json({
          error:
            e?.message ||
            "Report summary failed",
        });
      }
    }
  );

  // =========================================================
  // HEALTH CHECK
  // =========================================================

  app.get(
    "/api/health",
    (req, res) => {
      res.json({
        status: "ok",
        message:
          "Smart Medicine Assistant API is running",
      });
    }
  );

  // =========================================================
  // REAL SMS / CALL REMINDERS
  // =========================================================

  app.post(
    "/api/reminders/send",
    async (req, res) => {
      const {
        type,
        recipient,
        message,
        userId,
        doseId,
        medicineName,
      } = req.body;

      const host =
        getServerHost(req);

      console.log(
        `[Reminder Send] Type: ${type}, User: ${userId}, Medicine: ${medicineName}, Detected Host: ${host}`
      );

      if (!twilioClient) {
        console.warn(
          "Twilio not configured. Simulated send."
        );

        return res.json({
          status: "Simulated",
          message:
            "Twilio credentials missing",
        });
      }

      try {
        const results = [];

        if (
          type === "CALL" ||
          type === "BOTH"
        ) {
          const call =
            await triggerCall(
              recipient,
              medicineName ||
                "your medicine",
              userId,
              doseId,
              host
            );

          console.log(
            `[Twilio] Call triggered: SID=${call?.sid}`
          );

          results.push({
            type: "CALL",
            sid: call?.sid,
          });
        }

        if (
          type === "SMS" ||
          type === "BOTH"
        ) {
          const sms =
            await twilioClient.messages.create(
              {
                body:
                  message ||
                  `Reminder: Please take your medicine ${medicineName}`,
                to: recipient,
                from:
                  process.env
                    .TWILIO_PHONE_NUMBER!,
              }
            );

          console.log(
            `[Twilio] SMS triggered: SID=${sms.sid}`
          );

          results.push({
            type: "SMS",
            sid: sms.sid,
          });
        }

        res.json({
          status: "Sent",
          results,
        });
      } catch (error) {
        console.error(
          "[Twilio Error] ",
          error
        );

        res.status(500).json({
          status: "Error",
          error: String(error),
        });
      }
    }
  );

  // =========================================================
  // TWILIO STATUS CALLBACK
  // =========================================================

  app.post(
    "/api/twilio/status-callback",
    async (req, res) => {
      const {
        userId,
        doseId,
        medicineName,
      } = req.query;

      const {
        CallStatus,
      } = req.body;

      console.log(
        `[Twilio Status] Call finished: status=${CallStatus}, userId=${userId}, doseId=${doseId}`
      );

      const failureStatuses = [
        "no-answer",
        "busy",
        "failed",
        "canceled",
      ];

      if (
        failureStatuses.includes(
          CallStatus as string
        )
      ) {
        console.log(
          `[Twilio Status] Call missed (${CallStatus}). Notifying caregiver...`
        );

        await updateDoseStatus(
          userId as string,
          doseId as string,
          "missed"
        );

        await notifyCaregiver(
          userId as string,
          medicineName as string
        );
      } else if (
        CallStatus === "completed"
      ) {
        try {
          const doseDoc =
            await fdb
              .collection("users")
              .doc(
                userId as string
              )
              .collection("doses")
              .doc(
                doseId as string
              )
              .get();

          if (doseDoc.exists) {
            const doseData =
              doseDoc.data();

            if (
              doseData?.status ===
              "pending"
            ) {
              console.log(
                `[Twilio Status] Call completed but dose still pending. Treating as missed interaction.`
              );

              await updateDoseStatus(
                userId as string,
                doseId as string,
                "missed"
              );

              await notifyCaregiver(
                userId as string,
                medicineName as string
              );
            } else {
              console.log(
                `[Twilio Status] Call completed and dose status is: ${doseData?.status}`
              );
            }
          }
        } catch (e) {
          console.error(
            "[Twilio Status Callback Error]",
            e
          );
        }
      }

      res.sendStatus(200);
    }
  );

  // =========================================================
  // HEALTHCARE GEOCODE
  // =========================================================

  app.get(
    "/api/healthcare/geocode",
    async (req, res) => {
      try {
        const q =
          req.query.q as string;

        if (!q || !q.trim()) {
          return res
            .status(400)
            .json({
              error:
                "Missing query parameter q",
            });
        }

        const url =
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            q.trim()
          )}&addressdetails=1&limit=5`;

        const response =
          await fetch(url, {
            headers: {
              "User-Agent":
                "SmartMed-HealthcareAssistant/1.0",
              Accept:
                "application/json",
            },
          });

        if (!response.ok) {
          return res
            .status(response.status)
            .json({
              error:
                "Nominatim service error",
            });
        }

        const data: any =
          await response.json();

        const results =
          (Array.isArray(data)
            ? data
            : []
          ).map((item: any) => {
            const addr =
              item.address ||
              {};

            const shortName =
              addr.city ||
              addr.town ||
              addr.village ||
              addr.suburb ||
              addr.county ||
              item.name ||
              q;

            const state =
              addr.state ||
              addr.region ||
              "";

            const country =
              addr.country ||
              "";

            const displayParts =
              [
                shortName,
                state,
                country,
              ].filter(Boolean);

            return {
              name: shortName,
              lat: parseFloat(
                item.lat
              ),
              lng: parseFloat(
                item.lon
              ),
              displayName:
                item.display_name ||
                displayParts.join(
                  ", "
                ),
            };
          });

        res.json(results);
      } catch (err: any) {
        console.error(
          "[Geocode Error]",
          err
        );

        res.status(500).json({
          error:
            err.message ||
            "Failed to geocode",
        });
      }
    }
  );

  // =========================================================
  // HEALTHCARE REVERSE GEOCODE
  // =========================================================

  app.get(
    "/api/healthcare/reverse",
    async (req, res) => {
      try {
        const lat =
          parseFloat(
            req.query.lat as string
          );

        const lon =
          parseFloat(
            req.query.lon as string
          );

        if (
          isNaN(lat) ||
          isNaN(lon)
        ) {
          return res
            .status(400)
            .json({
              error:
                "Invalid lat/lon parameters",
            });
        }

        const url =
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`;

        const response =
          await fetch(url, {
            headers: {
              "User-Agent":
                "SmartMed-HealthcareAssistant/1.0",
              Accept:
                "application/json",
            },
          });

        if (!response.ok) {
          return res
            .status(response.status)
            .json({
              error:
                "Nominatim reverse error",
            });
        }

        const data: any =
          await response.json();

        const addr =
          data.address || {};

        const locality =
          addr.suburb ||
          addr.neighbourhood ||
          addr.city ||
          addr.town ||
          addr.village ||
          addr.county;

        const state =
          addr.state || "";

        let displayName = "";

        if (
          locality &&
          state
        ) {
          displayName =
            `${locality}, ${state}`;
        } else if (
          locality
        ) {
          displayName =
            locality;
        } else {
          displayName =
            data.display_name
              ?.split(",")
              .slice(0, 3)
              .join(",") ||
            `${lat.toFixed(
              4
            )}, ${lon.toFixed(4)}`;
        }

        res.json({
          displayName,
          raw: data,
        });
      } catch (err: any) {
        console.error(
          "[Reverse Geocode Error]",
          err
        );

        res.status(500).json({
          error:
            err.message ||
            "Failed to reverse geocode",
        });
      }
    }
  );

  // =========================================================
  // HEALTHCARE SEARCH
  // =========================================================

  app.post(
    "/api/healthcare/search",
    handleHealthcareSearch
  );

  // =========================================================
  // VITE
  // =========================================================

  if (
    process.env.NODE_ENV !==
    "production"
  ) {
    const vite =
      await createViteServer({
        server: {
          middlewareMode: true,
        },
        appType: "spa",
      });

    app.use(
      vite.middlewares
    );
  } else {
    const distPath =
      path.join(
        process.cwd(),
        "dist"
      );

    app.use(
      express.static(
        distPath
      )
    );

    app.get(
      "*",
      (req, res) => {
        res.sendFile(
          path.join(
            distPath,
            "index.html"
          )
        );
      }
    );
  }

  // =========================================================
  // START SERVER
  // =========================================================

  app.listen(
    PORT,
    "0.0.0.0",
    () => {
      console.log(
        `Server running on http://localhost:${PORT}`
      );
    }
  );
}

startServer();