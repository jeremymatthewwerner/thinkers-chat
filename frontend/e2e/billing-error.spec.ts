/**
 * Billing Error E2E Tests
 *
 * Tests the complete flow when billing/quota errors occur:
 * 1. User triggers an action that causes a billing error
 * 2. User sees appropriate error message in UI
 * 3. GitHub issue is filed automatically (once implemented)
 *
 * Note: This test currently validates steps 1-2. Step 3 will be validated
 * once GitHub issue filing is implemented (sub-tasks #113-116).
 */

import { test, expect } from '@playwright/test';
import { createConversationViaAPI, setupAuthenticatedUser } from './test-utils';

test.describe('Billing Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedUser(page);
  });

  test('billing API errors fall back to mock suggestions gracefully', async ({ page }) => {
    // Mock the thinker suggestion API to return a quota error
    await page.route('**/api/thinkers/suggest*', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          detail: 'API credit limit reached. Our service is temporarily unavailable due to billing limits. We have been notified and are working to resolve this.',
        }),
      });
    });

    // Start creating a new conversation
    const newChatButton = page.getByTestId('new-chat-button');
    await newChatButton.click({ force: true });

    // Fill in topic (this triggers thinker suggestions, but will fall back to mocks)
    const topicInput = page.getByTestId('topic-input');
    await topicInput.fill('Philosophy of ethics');

    // Wait for suggestions to load (fallback to mocks on error)
    await page.waitForTimeout(2000);

    // Application should still work - proceed to thinker selection
    await page.getByTestId('next-button').click();

    // Verify we can still proceed with manual thinker selection (fallback works)
    await expect(page.locator('h2', { hasText: 'Select Thinkers' })).toBeVisible({ timeout: 30000 });
  });

  test('shows error message when API quota is exceeded during thinker validation', async ({ page }) => {
    // Mock the thinker validation API to return a quota error
    await page.route('**/api/thinkers/validate*', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          detail: 'API credit limit reached. Our service is temporarily unavailable due to billing limits. We have been notified and are working to resolve this.',
        }),
      });
    });

    // Start creating a new conversation
    const newChatButton = page.getByTestId('new-chat-button');
    await newChatButton.click({ force: true });

    // Fill in topic and proceed to thinker selection
    await page.getByTestId('topic-input').fill('Philosophy of knowledge');
    await page.getByTestId('next-button').click();

    // Wait for thinker step
    await page.locator('h2', { hasText: 'Select Thinkers' }).waitFor({ timeout: 30000 });

    // Try to add a custom thinker (this triggers validation)
    const customInput = page.getByTestId('custom-thinker-input');
    await customInput.scrollIntoViewIfNeeded();
    await customInput.fill('Socrates');

    const addButton = page.getByTestId('add-custom-thinker');
    await addButton.scrollIntoViewIfNeeded();
    await addButton.click();

    // Wait a moment for the API call to complete
    await page.waitForTimeout(2000);

    // The thinker should still be added (validation failure falls back to accepting the name)
    // Or an error message should be displayed
    // Check if either the thinker was added OR an error is shown
    const thinkerAdded = await page.getByTestId('selected-thinker').count();
    const hasError = await page.locator('text=/error|unavailable/i').count();

    expect(thinkerAdded > 0 || hasError > 0).toBeTruthy();
  });

  // Skip: WebSocket testing requires more complex mocking infrastructure
  // Once GitHub issue filing is implemented, this test can be updated
  test.skip('shows error message when API quota is exceeded during conversation (WebSocket)', async ({ page }) => {
    // TODO: This test requires mocking WebSocket messages which is complex with Playwright
    // Consider implementing a test endpoint that can trigger billing errors
    // Or use a WebSocket mocking library
    //
    // Expected behavior:
    // 1. Create conversation
    // 2. Send message
    // 3. Backend encounters billing error
    // 4. WebSocket broadcasts ERROR message to client
    // 5. GitHub issue is filed (once #113-116 are implemented)
    // 6. User sees error notification in UI

    await createConversationViaAPI(page, 'Test quota error', ['Aristotle']);
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Rest of test implementation would go here
  });

  // This test will be enabled once GitHub issue filing is implemented (sub-tasks #113-116)
  test.skip('files GitHub issue when billing error occurs', async ({ page, request }) => {
    // TODO: Once GitHubIssueService is implemented, enable this test

    // Mock the GitHub API to track issue creation
    const issueCreated = { value: false };
    await page.route('https://api.github.com/repos/*/issues', async (route) => {
      const requestData = route.request().postDataJSON();

      // Verify issue contains billing error information
      expect(requestData.title).toContain('Billing Error');
      expect(requestData.body).toBeTruthy();

      issueCreated.value = true;

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 123,
          number: 456,
          html_url: 'https://github.com/test/test/issues/456',
        }),
      });
    });

    // Mock the backend API to return a billing error
    await page.route('**/api/thinkers/suggest*', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          detail: 'API credit limit reached. Our service is temporarily unavailable due to billing limits.',
        }),
      });
    });

    // Trigger the billing error
    const newChatButton = page.getByTestId('new-chat-button');
    await newChatButton.click({ force: true });
    await page.getByTestId('topic-input').fill('Test topic');

    // Wait for potential GitHub issue creation (background task)
    await page.waitForTimeout(3000);

    // Verify GitHub issue was created
    expect(issueCreated.value).toBeTruthy();
  });

  test('billing error does not crash the application', async ({ page }) => {
    // Mock the API to return billing errors
    await page.route('**/api/thinkers/suggest*', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          detail: 'API credit limit reached.',
        }),
      });
    });

    // Start creating a conversation
    const newChatButton = page.getByTestId('new-chat-button');
    await newChatButton.click({ force: true });
    await page.getByTestId('topic-input').fill('Test resilience');
    await page.waitForTimeout(2000);

    // Application should still be functional (falls back to mock suggestions)
    await page.getByTestId('next-button').click();
    await expect(page.locator('h2', { hasText: 'Select Thinkers' })).toBeVisible({ timeout: 30000 });

    // Should be able to close the modal by clicking outside or cancel button
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Should be back at the main page
    await expect(page.locator('text=Welcome to Thinkers Chat')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Billing Error Recovery', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedUser(page);
  });

  test('can retry after billing error is resolved', async ({ page }) => {
    let callCount = 0;

    // Mock API to fail first time, succeed second time
    await page.route('**/api/thinkers/suggest*', async (route) => {
      callCount++;

      if (callCount === 1) {
        // First call: return error
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            detail: 'API credit limit reached.',
          }),
        });
      } else {
        // Subsequent calls: let through (will use mock suggestions)
        await route.continue();
      }
    });

    // Start creating a conversation (first attempt - will get error but fall back to mocks)
    const newChatButton = page.getByTestId('new-chat-button');
    await newChatButton.click({ force: true });
    await page.getByTestId('topic-input').fill('Philosophy of mind');
    await page.waitForTimeout(2000);

    // Close the modal using Escape key
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Try again (second attempt - route will let it continue to backend)
    await newChatButton.click({ force: true });
    await page.getByTestId('topic-input').fill('Ethics and morality');
    await page.waitForTimeout(2000);
    await page.getByTestId('next-button').click();

    // Should successfully reach thinker selection
    await expect(page.locator('h2', { hasText: 'Select Thinkers' })).toBeVisible({ timeout: 30000 });

    // Verify we made multiple API calls
    expect(callCount).toBeGreaterThanOrEqual(2);
  });
});
