/**
 * Shared test utilities for E2E tests.
 */

import type { Page } from '@playwright/test';

const API_BASE = 'http://localhost:8000';

export interface ConversationSetup {
  id: string;
  topic: string;
}

/**
 * Creates a conversation directly via API for faster test setup.
 * Use this when you don't need to test the modal flow itself.
 */
export async function createConversationViaAPI(
  page: Page,
  topic: string,
  thinkerNames: string[] = ['Aristotle']
): Promise<ConversationSetup> {
  // Create conversation via API
  const createResponse = await page.request.post(`${API_BASE}/conversations`, {
    data: { topic },
  });
  const conversation = await createResponse.json();

  // Add thinkers via API
  for (const name of thinkerNames) {
    // Validate thinker first
    const validateResponse = await page.request.post(
      `${API_BASE}/thinkers/validate`,
      {
        data: { name },
      }
    );
    const validation = await validateResponse.json();

    if (validation.valid) {
      // Add thinker to conversation
      await page.request.post(
        `${API_BASE}/conversations/${conversation.id}/thinkers`,
        {
          data: {
            name: validation.profile.name,
            bio: validation.profile.bio,
            positions: validation.profile.positions,
            style: validation.profile.style,
            image_url: validation.profile.image_url,
          },
        }
      );
    }
  }

  return { id: conversation.id, topic };
}

/**
 * Helper to create a conversation using the UI flow.
 * Use this when you need to test a specific UI interaction.
 */
export async function createConversationViaUI(
  page: Page,
  topic: string,
  thinker: string
): Promise<void> {
  const newChatButton = page.getByTestId('new-chat-button');
  await newChatButton.click({ force: true });
  await page.getByTestId('topic-input').fill(topic);
  await page.getByTestId('next-button').click();

  // Wait for thinker step
  await page.locator('h2', { hasText: 'Select Thinkers' }).waitFor({ timeout: 30000 });

  // Add custom thinker
  const customInput = page.getByTestId('custom-thinker-input');
  await customInput.scrollIntoViewIfNeeded();
  await customInput.fill(thinker);
  const addButton = page.getByTestId('add-custom-thinker');
  await addButton.scrollIntoViewIfNeeded();
  await addButton.click();
  await page.getByTestId('selected-thinker').waitFor({ timeout: 15000 });

  // Create conversation
  const createButton = page.getByTestId('create-button');
  await createButton.scrollIntoViewIfNeeded();
  await createButton.click();
  await page.getByTestId('chat-area').waitFor({ timeout: 10000 });
}

/**
 * Clear localStorage and reload for fresh state.
 */
export async function resetPageState(page: Page): Promise<void> {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForLoadState('networkidle');
}
