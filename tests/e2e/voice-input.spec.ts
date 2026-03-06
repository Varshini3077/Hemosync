import { test, expect, BrowserContext, Page } from "@playwright/test";

/**
 * Voice input tests use a fake media stream so tests work in headless CI
 * without a real microphone.
 */

async function grantMicrophonePermission(context: BrowserContext): Promise<void> {
  await context.grantPermissions(["microphone"]);
}

async function mockSpeechRecognition(page: Page): Promise<void> {
  // Inject a fake SpeechRecognition that fires a result event after 1 second
  await page.addInitScript(() => {
    class FakeSpeechRecognition {
      continuous = false;
      interimResults = false;
      lang = "en-IN";
      onresult: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;

      start() {
        setTimeout(() => {
          if (this.onresult) {
            this.onresult({
              results: [
                [{ transcript: "Need 2 units O plus blood urgently at AIIMS", confidence: 0.95 }],
              ],
              resultIndex: 0,
            });
          }
          setTimeout(() => this.onend?.(), 200);
        }, 1000);
      }

      stop() {
        this.onend?.();
      }

      abort() {
        this.onend?.();
      }
    }

    (window as unknown as Record<string, unknown>)["SpeechRecognition"] = FakeSpeechRecognition;
    (window as unknown as Record<string, unknown>)["webkitSpeechRecognition"] = FakeSpeechRecognition;
  });
}

test.describe("Voice input on new request page", () => {
  test.beforeEach(async ({ context }) => {
    await grantMicrophonePermission(context);
  });

  test("microphone button turns red and shows Listening... when clicked", async ({ page }) => {
    await mockSpeechRecognition(page);
    await page.goto("/requests/new");

    const micButton = page.locator('[data-testid="mic-button"]');
    await expect(micButton).toBeVisible();

    // Click to start listening
    await micButton.click();

    // Button should turn red (active state)
    await expect(micButton).toHaveAttribute("data-listening", "true", { timeout: 2000 });

    // Listening label should be visible
    const listeningLabel = page.locator('[data-testid="listening-label"]');
    await expect(listeningLabel).toBeVisible();
    await expect(listeningLabel).toContainText("Listening");
  });

  test("transcript area is visible after stopping recording", async ({ page }) => {
    await mockSpeechRecognition(page);
    await page.goto("/requests/new");

    const micButton = page.locator('[data-testid="mic-button"]');
    await micButton.click();

    // Wait for fake speech recognition to complete (1.2 seconds)
    await page.waitForTimeout(1400);

    // Transcript area should now be visible with the fake transcript
    const transcriptArea = page.locator('[data-testid="transcript-area"]');
    await expect(transcriptArea).toBeVisible({ timeout: 3000 });
    await expect(transcriptArea).not.toBeEmpty();
  });

  test("clicking stop button ends recording", async ({ page }) => {
    await mockSpeechRecognition(page);
    await page.goto("/requests/new");

    const micButton = page.locator('[data-testid="mic-button"]');
    await micButton.click();

    // Should be listening
    await expect(micButton).toHaveAttribute("data-listening", "true", { timeout: 2000 });

    // Click again to stop
    await micButton.click();

    // Should no longer be listening
    await expect(micButton).not.toHaveAttribute("data-listening", "true");
  });
});
