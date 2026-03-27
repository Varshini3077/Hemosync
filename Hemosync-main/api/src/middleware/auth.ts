import type { HttpRequest, HttpResponseInit } from "@azure/functions";

const VALID_KEY_ENV = "APIM_SUBSCRIPTION_KEY";

export function validateApiKey(request: HttpRequest): HttpResponseInit | null {
  const apiKey = request.headers.get("x-api-key");

  if (!apiKey) {
    return {
      status: 401,
      jsonBody: {
        error: "Missing API key",
        code: "UNAUTHORIZED",
      },
    };
  }

  const validKey = process.env[VALID_KEY_ENV];
  if (!validKey || apiKey !== validKey) {
    return {
      status: 401,
      jsonBody: {
        error: "Invalid API key",
        code: "UNAUTHORIZED",
      },
    };
  }

  return null;
}
