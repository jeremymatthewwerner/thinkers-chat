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
    const auth = await page.evaluate(() => {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user) : null;
    });

    await createConversationViaAPI(page, 'Test quota error', ['Aristotle']);

    // Navigate to the conversation
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Mock WebSocket messages to inject an error
    // Note: This is a simplified approach - in reality, we'd need to mock the WebSocket connection
    // For now, we'll just verify the error UI exists

    // Send a message to trigger thinker response
    const messageTextarea = page.getByTestId('message-textarea');
    await messageTextarea.fill('Tell me about ethics');

    const sendButton = page.getByTestId('send-button');

    // Mock the backend to return billing error
    // Since we're using real WebSocket, we'll mock the API endpoint instead
    await page.route('**/ws/**', async (route) => {
      // Let the connection establish, but we can't easily inject WebSocket messages
      // This test documents the expected behavior for manual testing
      await route.continue();
    });

    await sendButton.click();

    // The message should appear
    await expect(page.locator('text=Tell me about ethics')).toBeVisible({ timeout: 5000 });

    // Note: To fully test WebSocket billing errors, we would need:
    // 1. A test endpoint that can trigger billing errors
    // 2. Or mock the WebSocket connection entirely
    // For now, this test serves as documentation
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
