/**
 * Homepage E2E tests.
 * These are fast tests that don't require API calls.
 */

import { test, expect } from '@playwright/test';
import { resetPageState } from './test-utils';

test.describe('Homepage', () => {
  test('loads and shows welcome message', async ({ page }) => {
    await page.goto('/');

    // Should show the welcome message when no conversation selected
    const welcomeText = page.locator('text=Welcome to Thinkers Chat');
    await expect(welcomeText).toBeVisible();

    // Should show the new chat button in sidebar
    const newChatButton = page.getByTestId('new-chat-button');
    await expect(newChatButton).toBeVisible();
  });

  test('sidebar shows empty state initially', async ({ page }) => {
    await page.goto('/');
    await resetPageState(page);

    // Should show empty conversation list
    const emptyState = page.getByTestId('conversation-list-empty');
    await expect(emptyState).toBeVisible();
  });
});
