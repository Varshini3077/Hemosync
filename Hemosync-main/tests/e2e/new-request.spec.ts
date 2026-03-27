import { test, expect } from "@playwright/test";

test.describe("New blood request flow", () => {
  test("submit new request and see broadcast status page", async ({ page }) => {
    await page.goto("/requests/new");

    // Fill blood type
    await page.selectOption('[data-testid="blood-type-select"]', "O+");

    // Fill units
    await page.fill('[data-testid="units-input"]', "2");

    // Set urgency
    await page.selectOption('[data-testid="urgency-select"]', "CRITICAL");

    // Submit the form
    await page.click('[data-testid="submit-request-btn"]');

    // Assert: broadcast status page loads
    await expect(page).toHaveURL(/\/requests\/.*\/status/, { timeout: 10_000 });

    // Assert: 5 bank rows are visible
    const bankRows = page.locator('[data-testid="bank-row"]');
    await expect(bankRows).toHaveCount(5, { timeout: 15_000 });

    // Assert: timer is counting up
    const timer = page.locator('[data-testid="broadcast-timer"]');
    await expect(timer).toBeVisible();

    // Read timer value and wait 2 seconds; value should have incremented
    const initialTimerText = await timer.textContent();
    await page.waitForTimeout(2000);
    const updatedTimerText = await timer.textContent();
    expect(updatedTimerText).not.toBe(initialTimerText);
  });

  test("form validation prevents submission with missing fields", async ({ page }) => {
    await page.goto("/requests/new");

    // Try to submit without filling any fields
    await page.click('[data-testid="submit-request-btn"]');

    // Should not navigate away
    await expect(page).toHaveURL(/\/requests\/new/);

    // Validation errors should be visible
    const errorMessages = page.locator('[data-testid="field-error"]');
    await expect(errorMessages.first()).toBeVisible();
  });
});
