import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import * as sdk from "microsoft-cognitiveservices-speech-sdk";
import { z } from "zod";
import { randomUUID } from "crypto";
import { validateApiKey } from "../../middleware/auth.js";
import { createLogger } from "../../middleware/logger.js";
import { getSpeechKey } from "../../middleware/keyvault.js";

const RequestBodySchema = z.object({
  audio: z.string().min(1, "Base64-encoded audio is required"),
  language: z.string().optional().default("en-IN"),
});

function transcribeAudio(
  audioBuffer: Buffer,
  speechKey: string,
  speechRegion: string,
  language: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const speechConfig = sdk.SpeechConfig.fromSubscription(speechKey, speechRegion);
    speechConfig.speechRecognitionLanguage = language;

    const pushStream = sdk.AudioInputStream.createPushStream();
    pushStream.write(audioBuffer);
    pushStream.close();

    const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

    recognizer.recognizeOnceAsync(
      (result) => {
        recognizer.close();
        if (result.reason === sdk.ResultReason.RecognizedSpeech) {
          resolve(result.text);
        } else if (result.reason === sdk.ResultReason.NoMatch) {
          resolve("");
        } else {
          const cancellationDetails = sdk.CancellationDetails.fromResult(result);
          reject(
            new Error(
              `Speech recognition cancelled: ${cancellationDetails.reason} — ${cancellationDetails.errorDetails}`
            )
          );
        }
      },
      (err) => {
        recognizer.close();
        reject(new Error(`Speech SDK error: ${String(err)}`));
      }
    );
  });
}

export async function speechToText(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const requestId = randomUUID();
  const logger = createLogger("speech-to-text", requestId);
  const startTime = Date.now();

  const authError = validateApiKey(request);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      status: 400,
      jsonBody: { error: "Invalid JSON body", code: "BAD_REQUEST", requestId },
    };
  }

  const parsed = RequestBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      status: 400,
      jsonBody: {
        error: parsed.error.errors.map((e) => e.message).join(", "),
        code: "VALIDATION_ERROR",
        requestId,
      },
    };
  }

  const { audio, language } = parsed.data;

  let audioBuffer: Buffer;
  try {
    audioBuffer = Buffer.from(audio, "base64");
  } catch {
    return {
      status: 400,
      jsonBody: {
        error: "Invalid base64 audio encoding",
        code: "VALIDATION_ERROR",
        requestId,
      },
    };
  }

  if (audioBuffer.length === 0) {
    return {
      status: 400,
      jsonBody: {
        error: "Audio buffer is empty",
        code: "VALIDATION_ERROR",
        requestId,
      },
    };
  }

  const speechRegion = process.env["AZURE_SPEECH_REGION"];
  if (!speechRegion) {
    return {
      status: 500,
      jsonBody: {
        error: "AZURE_SPEECH_REGION environment variable is not configured",
        code: "CONFIGURATION_ERROR",
        requestId,
      },
    };
  }

  try {
    const speechKey = await getSpeechKey();

    logger.info("Starting speech transcription", {
      audioSizeBytes: audioBuffer.length,
      language,
    });

    const transcribedText = await transcribeAudio(audioBuffer, speechKey, speechRegion, language);

    logger.info("Transcription complete", { textLength: transcribedText.length });
    logger.trackRequest(Date.now() - startTime, 200);

    return {
      status: 200,
      jsonBody: {
        text: transcribedText,
        requestId,
        language,
      },
    };
  } catch (err) {
    logger.error("Speech transcription failed", err);
    return {
      status: 500,
      jsonBody: {
        error: err instanceof Error ? err.message : "Internal server error",
        code: "INTERNAL_ERROR",
        requestId,
      },
    };
  }
}

app.http("speech-to-text", {
  methods: ["POST"],
  route: "speech-to-text",
  authLevel: "anonymous",
  handler: speechToText,
});
