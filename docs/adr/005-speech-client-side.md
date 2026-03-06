# ADR 005 — Client-Side Azure Speech SDK for Voice Input

**Date:** 2024-11-29
**Status:** Accepted

---

## Context

HemoSync's web dashboard supports voice input for blood requests. A coordinator can click a microphone button, dictate "Need 2 units O+ urgently at AIIMS", and the transcript is submitted to `/api/parse-request`. We evaluated two approaches for speech-to-text (STT):

**Option A — Server-side STT (audio upload):**
- Browser records audio (WAV/WebM), uploads binary blob to a `/speech-to-text` endpoint
- Server calls Azure AI Speech SDK, returns transcript
- Round-trip: browser → upload (variable, 1–5s depending on audio length) → speech API → transcript → browser
- Additional latency: ~2–4 seconds for upload + transcription
- Server must handle audio streaming or buffered upload; complex streaming logic
- Audio data never leaves the browser until transcript is ready = privacy concern mitigated

**Option B — Client-side STT (browser SDK):**
- Azure AI Speech SDK runs directly in the browser (available as a CDN/npm package)
- Browser streams microphone audio directly to Azure Speech service endpoint using a short-lived token
- Token is issued by a lightweight `/api/speech-to-text` endpoint (returns a 10-minute auth token, not audio)
- Only the transcribed text is sent to the API — not the audio
- Round-trip: browser → Speech SDK (real-time, ~200ms streaming latency) → transcript appears live → submit to parse-request
- Eliminates the audio upload round-trip entirely

---

## Decision

Use the **Azure AI Speech SDK running client-side in the browser**. The `/api/speech-to-text` endpoint serves only as a token vending machine — it issues a 10-minute speech token and the browser SDK uses it to authenticate directly with Azure Speech Services.

The web dashboard (`apps/web`) uses `microsoft-cognitiveservices-speech-sdk` as an npm dependency. The `SpeechInput` React component manages microphone state, displays a live transcript, and calls `onTranscript(text)` when recognition ends.

The speech key is **never exposed to the browser**. The token endpoint exchanges the server-side `AZURE_SPEECH_KEY` for a short-lived token, which is the only credential the browser receives.

---

## Consequences

**Positive:**
- Eliminates audio upload round-trip; reduces voice-to-text latency by approximately 2 seconds
- Live transcription feedback ("Listening..." with animated text) improves UX in a time-critical emergency flow
- No audio ever stored server-side; transcript-only reduces data handling surface area
- Token vending is a trivial endpoint (no audio processing complexity server-side)

**Negative:**
- Requires microphone permission in the browser (`getUserMedia`); coordinators must approve on first use
- Not supported in all browsers (Safari on iOS has limited support; coordinators advised to use Chrome or Edge)
- Browser must have a network path to Azure Speech endpoint directly (not proxied through APIM); firewall rules must allow outbound to `*.cognitiveservices.azure.com`
- If speech key is rotated, all issued tokens expire within 10 minutes (acceptable refresh window)
