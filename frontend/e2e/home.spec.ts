import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('loads and shows new conversation button', async ({ page }) => {
    await page.goto('/');

    // Should show the new chat button in sidebar
    const newChatButton = page.locator('button', { hasText: /new.*chat|new.*conversation/i });
    await expect(newChatButton.first()).toBeVisible();
  });
});

test.describe('New Conversation Flow', () => {
  test('can create a new conversation with suggested thinkers', async ({ page }) => {
    await page.goto('/');

    // Wait for initial load
    await page.waitForLoadState('networkidle');

    // Click new chat button
    const newChatButton = page.locator('button', { hasText: /new.*chat|new.*conversation/i });
    await newChatButton.first().click();

    // Modal should appear
    const modal = page.locator('[data-testid="new-chat-modal"]');
    await expect(modal).toBeVisible();

    // Enter a topic
    const topicInput = page.locator('[data-testid="topic-input"]');
    await topicInput.fill('The nature of consciousness');

    // Click Next
    const nextButton = page.locator('[data-testid="next-button"]');
    await nextButton.click();

    // Wait for thinker suggestions (this calls the real backend API)
    // The header should change to "Select Thinkers"
    await expect(page.locator('h2', { hasText: 'Select Thinkers' })).toBeVisible({ timeout: 30000 });

    // Should see suggested thinkers
    const thinkerCards = page.locator('[data-testid="thinker-suggestion"]');
    await expect(thinkerCards.first()).toBeVisible({ timeout: 10000 });

    // Select a thinker by clicking on it
    await thinkerCards.first().click();

    // Create button should be enabled
    const createButton = page.locator('[data-testid="create-button"]');
    await expect(createButton).toBeEnabled();

    // Click create - this is where the bug was! This calls the real backend
    await createButton.click();

    // Modal should close and conversation should be created
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    // Wait for chat area to appear (conversation loaded)
    const chatArea = page.locator('[data-testid="chat-area"]');
    await expect(chatArea).toBeVisible({ timeout: 10000 });

    // Should see the topic in the chat area header
    await expect(chatArea.locator('h2', { hasText: 'The nature of consciousness' })).toBeVisible();
  });

  test('shows error when conversation creation fails', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click new chat button
    const newChatButton = page.locator('button', { hasText: /new.*chat|new.*conversation/i });
    await newChatButton.first().click();

    // Modal should appear
    const modal = page.locator('[data-testid="new-chat-modal"]');
    await expect(modal).toBeVisible();

    // Enter a topic
    const topicInput = page.locator('[data-testid="topic-input"]');
    await topicInput.fill('Test topic');

    // Click Next
    const nextButton = page.locator('[data-testid="next-button"]');
    await nextButton.click();

    // Wait for thinker step
    await expect(page.locator('h2', { hasText: 'Select Thinkers' })).toBeVisible({ timeout: 30000 });

    // Try to create without selecting any thinkers
    const createButton = page.locator('[data-testid="create-button"]');

    // Create button should be disabled when no thinkers selected
    await expect(createButton).toBeDisabled();
  });
});
