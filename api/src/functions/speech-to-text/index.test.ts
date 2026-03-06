import { speechToText } from "./index";
import { HttpRequest, InvocationContext } from "@azure/functions";

jest.mock("../../middleware/keyvault", () => ({
  getSpeechKey: jest.fn().mockResolvedValue("mock-speech-key"),
}));

jest.mock("../../middleware/auth", () => ({
  validateApiKey: jest.fn().mockReturnValue(null),
}));

// Mock the Speech SDK
const mockRecognizeOnceAsync = jest.fn();
const mockClose = jest.fn();
const mockWrite = jest.fn();
const mockStreamClose = jest.fn();

jest.mock("microsoft-cognitiveservices-speech-sdk", () => ({
  SpeechConfig: {
    fromSubscription: jest.fn().mockReturnValue({
      speechRecognitionLanguage: "",
    }),
  },
  AudioInputStream: {
    createPushStream: jest.fn().mockReturnValue({
      write: mockWrite,
      close: mockStreamClose,
    }),
  },
  AudioConfig: {
    fromStreamInput: jest.fn().mockReturnValue({}),
  },
  SpeechRecognizer: jest.fn().mockImplementation(() => ({
    recognizeOnceAsync: mockRecognizeOnceAsync,
    close: mockClose,
  })),
  ResultReason: {
    RecognizedSpeech: "RecognizedSpeech",
    NoMatch: "NoMatch",
    Canceled: "Canceled",
  },
  CancellationDetails: {
    fromResult: jest.fn().mockReturnValue({
      reason: "Error",
      errorDetails: "Service unavailable",
    }),
  },
}));

function makeRequest(body: unknown): HttpRequest {
  return {
    json: async () => body,
    headers: { get: () => "valid-key" },
  } as unknown as HttpRequest;
}

function makeContext(): InvocationContext {
  return {} as InvocationContext;
}

// Sample minimal WAV audio as base64 (44 bytes of silence)
const SAMPLE_AUDIO_BASE64 = Buffer.from(new Uint8Array(1024).fill(0)).toString("base64");

describe("speech-to-text function", () => {
  beforeEach(() => {
    process.env["AZURE_SPEECH_REGION"] = "eastus";
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("happy path: transcribes audio and returns text", async () => {
    mockRecognizeOnceAsync.mockImplementationOnce((successCallback: (result: { reason: string; text: string }) => void) => {
      successCallback({ reason: "RecognizedSpeech", text: "Need two units O positive blood urgently" });
    });

    const body = { audio: SAMPLE_AUDIO_BASE64 };
    const response = await speechToText(makeRequest(body), makeContext());

    expect(response.status).toBe(200);
    const json = response.jsonBody as Record<string, unknown>;
    expect(json["text"]).toBe("Need two units O positive blood urgently");
    expect(json["requestId"]).toBeDefined();
  });

  it("returns empty string when no speech is detected", async () => {
    mockRecognizeOnceAsync.mockImplementationOnce((successCallback: (result: { reason: string; text: string }) => void) => {
      successCallback({ reason: "NoMatch", text: "" });
    });

    const body = { audio: SAMPLE_AUDIO_BASE64 };
    const response = await speechToText(makeRequest(body), makeContext());

    expect(response.status).toBe(200);
    const json = response.jsonBody as Record<string, unknown>;
    expect(json["text"]).toBe("");
  });

  it("returns 400 when audio field is missing", async () => {
    const body = {};
    const response = await speechToText(makeRequest(body), makeContext());

    expect(response.status).toBe(400);
    const json = response.jsonBody as Record<string, unknown>;
    expect(json["code"]).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when body is invalid JSON", async () => {
    const badRequest = {
      json: async () => { throw new Error("Invalid JSON"); },
      headers: { get: () => "valid-key" },
    } as unknown as HttpRequest;

    const response = await speechToText(badRequest, makeContext());
    expect(response.status).toBe(400);
    const json = response.jsonBody as Record<string, unknown>;
    expect(json["code"]).toBe("BAD_REQUEST");
  });

  it("returns 500 when Azure Speech SDK throws", async () => {
    mockRecognizeOnceAsync.mockImplementationOnce((_success: unknown, errorCallback: (err: Error) => void) => {
      errorCallback(new Error("Speech service connection failed"));
    });

    const body = { audio: SAMPLE_AUDIO_BASE64 };
    const response = await speechToText(makeRequest(body), makeContext());

    expect(response.status).toBe(500);
    const json = response.jsonBody as Record<string, unknown>;
    expect(json["code"]).toBe("INTERNAL_ERROR");
    expect(json["requestId"]).toBeDefined();
  });

  it("returns 500 when AZURE_SPEECH_REGION is not configured", async () => {
    delete process.env["AZURE_SPEECH_REGION"];

    const body = { audio: SAMPLE_AUDIO_BASE64 };
    const response = await speechToText(makeRequest(body), makeContext());

    expect(response.status).toBe(500);
    const json = response.jsonBody as Record<string, unknown>;
    expect(json["code"]).toBe("CONFIGURATION_ERROR");
  });

  it("returns 401 when API key is invalid", async () => {
    const { validateApiKey } = await import("../../middleware/auth");
    (validateApiKey as jest.Mock).mockReturnValueOnce({
      status: 401,
      jsonBody: { error: "Invalid API key", code: "UNAUTHORIZED" },
    });

    const body = { audio: SAMPLE_AUDIO_BASE64 };
    const response = await speechToText(makeRequest(body), makeContext());

    expect(response.status).toBe(401);
  });
});
