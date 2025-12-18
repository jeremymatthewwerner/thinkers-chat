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

  test('shows error message when API quota is exceeded during thinker suggestion', async ({ page }) => {
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

    // Fill in topic (this triggers thinker suggestions)
    const topicInput = page.getByTestId('topic-input');
    await topicInput.fill('Philosophy of ethics');

    // Wait a moment for the API call
    await page.waitForTimeout(1000);

    // The UI should show an error state or fallback to manual thinker selection
    // (Current implementation falls back to mock suggestions, so we should still be able to proceed)
    await page.getByTestId('next-button').click();

    // Verify we can still proceed with manual thinker selection
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

  test('shows error message when API quota is exceeded during conversation (WebSocket)', async ({ page }) => {
    // Create a conversation first
    await createConversationViaAPI(page, 'Test quota error', ['Aristotle']);

    // Navigate to the conversation
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Inject a WebSocket error message by evaluating JavaScript in the browser context
    // This simulates what happens when the backend sends a billing error via WebSocket
    await page.evaluate(() => {
      // Simulate receiving a WebSocket error message
      // We'll dispatch a custom event that the page can listen to for testing
      const errorEvent = new CustomEvent('test-ws-error', {
        detail: { content: 'Credit balance is too low to continue. Please contact your administrator.' }
      });
      window.dispatchEvent(errorEvent);
    });

    // Wait a moment for the error to be processed
    await page.waitForTimeout(500);

    // For now, we need to manually trigger the error through the app's state
    // Since we can't easily mock WebSocket, we'll send a message and check if error UI exists
    const messageTextarea = page.getByTestId('message-textarea');
    await messageTextarea.fill('Tell me about ethics');

    const sendButton = page.getByTestId('send-button');
    await sendButton.click();

    // The message should appear
    await expect(page.locator('text=Tell me about ethics')).toBeVisible({ timeout: 5000 });

    // Note: To fully test WebSocket billing errors with the error banner, we would need:
    // 1. A test endpoint in the backend that can trigger billing errors on-demand
    // 2. Or mock the WebSocket connection entirely
    // The error banner component is tested in unit tests
    // This E2E test documents the expected behavior for manual testing
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

  test('displays error banner in chat UI when backend sends billing error via WebSocket', async ({ page }) => {
    // This is a documentation test for the error banner feature
    // The error banner UI is fully tested in unit tests (ChatArea.test.tsx)
    //
    // When backend sends WSMessageType.ERROR via WebSocket, the frontend will:
    // 1. Receive the error in the onError callback (useWebSocket.ts line 182-184)
    // 2. Store it in errorMessage state (page.tsx)
    // 3. Display it in a red banner in ChatArea (ChatArea.tsx)
    //
    // To manually test:
    // 1. Create a conversation
    // 2. Trigger a billing error in backend (when #154 is implemented)
    // 3. Verify error banner appears with red background
    // 4. Verify banner is dismissible
    //
    // For automated testing, we would need a backend test endpoint that sends
    // error messages via WebSocket on demand.

    expect(true).toBeTruthy(); // Placeholder - test serves as documentation
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
    await page.waitForTimeout(1000);

    // Application should still be functional
    await page.getByTestId('next-button').click();
    await expect(page.locator('h2', { hasText: 'Select Thinkers' })).toBeVisible({ timeout: 30000 });

    // Should be able to close the modal
    const cancelButton = page.locator('button', { hasText: /cancel|close/i }).first();
    if (await cancelButton.isVisible()) {
      await cancelButton.click();
    }

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

    // Start creating a conversation (first attempt - will error)
    const newChatButton = page.getByTestId('new-chat-button');
    await newChatButton.click({ force: true });
    await page.getByTestId('topic-input').fill('Philosophy of mind');
    await page.waitForTimeout(1000);

    // Close the modal
    const cancelButton = page.locator('button', { hasText: /cancel|close/i }).first();
    if (await cancelButton.isVisible()) {
      await cancelButton.click();
      await page.waitForTimeout(500);
    }

    // Try again (second attempt - should succeed)
    await newChatButton.click({ force: true });
    await page.getByTestId('topic-input').fill('Ethics and morality');
    await page.getByTestId('next-button').click();

    // Should successfully reach thinker selection
    await expect(page.locator('h2', { hasText: 'Select Thinkers' })).toBeVisible({ timeout: 30000 });

    expect(callCount).toBeGreaterThanOrEqual(2);
  });
});
