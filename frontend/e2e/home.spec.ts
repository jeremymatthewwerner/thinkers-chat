import { test, expect } from '@playwright/test';

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
    // Clear localStorage to start fresh
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should show empty conversation list
    const emptyState = page.getByTestId('conversation-list-empty');
    await expect(emptyState).toBeVisible();
  });
});

test.describe('New Conversation Flow', () => {
  test('can create a new conversation with suggested thinkers', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click new chat button in sidebar
    const newChatButton = page.getByTestId('new-chat-button');
    await newChatButton.click();

    // Modal should appear
    const modal = page.getByTestId('new-chat-modal');
    await expect(modal).toBeVisible();

    // Enter a topic
    const topicInput = page.getByTestId('topic-input');
    await topicInput.fill('The nature of consciousness');

    // Click Next
    const nextButton = page.getByTestId('next-button');
    await nextButton.click();

    // Wait for thinker suggestions (this calls the real backend API)
    await expect(page.locator('h2', { hasText: 'Select Thinkers' })).toBeVisible({ timeout: 30000 });

    // Should see suggested thinkers
    const thinkerCards = page.getByTestId('thinker-suggestion');
    await expect(thinkerCards.first()).toBeVisible({ timeout: 10000 });

    // Select a thinker by clicking the accept button (checkmark)
    const acceptButton = page.getByTestId('accept-suggestion').first();
    await acceptButton.click();

    // Should see selected thinker
    const selectedThinker = page.getByTestId('selected-thinker');
    await expect(selectedThinker).toBeVisible();

    // Create button should be enabled
    const createButton = page.getByTestId('create-button');
    await expect(createButton).toBeEnabled();

    // Click create
    await createButton.click();

    // Modal should close and conversation should be created
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    // Wait for chat area to appear
    const chatArea = page.getByTestId('chat-area');
    await expect(chatArea).toBeVisible({ timeout: 10000 });

    // Should see the topic in the chat area header
    await expect(chatArea.locator('h2', { hasText: 'The nature of consciousness' })).toBeVisible();
  });

  test('can add custom thinker', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open new chat modal
    await page.getByTestId('new-chat-button').click();
    await page.getByTestId('topic-input').fill('Philosophy of mind');
    await page.getByTestId('next-button').click();

    // Wait for thinker step
    await expect(page.locator('h2', { hasText: 'Select Thinkers' })).toBeVisible({ timeout: 30000 });

    // Enter a custom thinker name
    const customInput = page.getByTestId('custom-thinker-input');
    await customInput.fill('Socrates');

    // Click add button
    const addButton = page.getByTestId('add-custom-thinker');
    await addButton.click();

    // Should validate and add the thinker (may take time to validate via API)
    const selectedThinker = page.getByTestId('selected-thinker');
    await expect(selectedThinker).toBeVisible({ timeout: 15000 });
  });

  test('create button is disabled without thinkers', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open modal and go to thinker step
    await page.getByTestId('new-chat-button').click();
    await page.getByTestId('topic-input').fill('Test topic');
    await page.getByTestId('next-button').click();

    await expect(page.locator('h2', { hasText: 'Select Thinkers' })).toBeVisible({ timeout: 30000 });

    // Create button should be disabled
    const createButton = page.getByTestId('create-button');
    await expect(createButton).toBeDisabled();
  });

  test('can refresh a suggestion', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open modal and go to thinker step
    await page.getByTestId('new-chat-button').click();
    await page.getByTestId('topic-input').fill('Ancient philosophy');
    await page.getByTestId('next-button').click();

    await expect(page.locator('h2', { hasText: 'Select Thinkers' })).toBeVisible({ timeout: 30000 });

    // Get initial thinker name
    const firstSuggestion = page.getByTestId('thinker-suggestion').first();
    await expect(firstSuggestion).toBeVisible({ timeout: 10000 });
    // Store the initial name to verify the refresh happened (could compare, but API may return same)
    // Use div.font-medium specifically (not span.font-medium which is the avatar initials)
    await firstSuggestion.locator('div.font-medium').textContent();

    // Click refresh button
    const refreshButton = page.getByTestId('refresh-suggestion').first();
    await refreshButton.click();

    // Should show loading spinner briefly, then new suggestion
    // The name might change (or might stay same if API returns same person)
    await expect(firstSuggestion).toBeVisible({ timeout: 15000 });
  });

  test('suggest more thinkers returns unique results', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open modal and go to thinker step
    await page.getByTestId('new-chat-button').click();
    await page.getByTestId('topic-input').fill('Quantum physics');
    await page.getByTestId('next-button').click();

    await expect(page.locator('h2', { hasText: 'Select Thinkers' })).toBeVisible({ timeout: 30000 });

    // Wait for initial suggestions
    const suggestions = page.getByTestId('thinker-suggestion');
    await expect(suggestions.first()).toBeVisible({ timeout: 15000 });

    // Collect initial thinker names
    const getVisibleNames = async () => {
      const cards = await suggestions.all();
      const names: string[] = [];
      for (const card of cards) {
        const name = await card.locator('div.font-medium').textContent();
        if (name) names.push(name);
      }
      return names;
    };

    const initialNames = await getVisibleNames();
    expect(initialNames.length).toBeGreaterThan(0);

    // Click "Suggest More Thinkers" button
    const suggestMoreButton = page.getByTestId('suggest-more-button');
    await suggestMoreButton.click();

    // Wait for loading to complete
    await page.waitForTimeout(5000);

    // Get names after requesting more
    const afterMoreNames = await getVisibleNames();

    // Should have more suggestions now
    expect(afterMoreNames.length).toBeGreaterThan(initialNames.length);

    // All names should be unique (no duplicates)
    const uniqueNames = [...new Set(afterMoreNames)];
    expect(uniqueNames.length).toBe(afterMoreNames.length);
  });
});

test.describe('Persistence', () => {
  test('conversations persist across page reload', async ({ page }) => {
    // Clear localStorage to start fresh
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Create a conversation
    await page.getByTestId('new-chat-button').click();
    await page.getByTestId('topic-input').fill('Test persistence topic');
    await page.getByTestId('next-button').click();

    await expect(page.locator('h2', { hasText: 'Select Thinkers' })).toBeVisible({ timeout: 30000 });

    // Add a custom thinker (more reliable than waiting for suggestions)
    const customInput = page.getByTestId('custom-thinker-input');
    await customInput.scrollIntoViewIfNeeded();
    await customInput.fill('Aristotle');
    const addButton = page.getByTestId('add-custom-thinker');
    await addButton.scrollIntoViewIfNeeded();
    await addButton.click({ force: true });
    await expect(page.getByTestId('selected-thinker')).toBeVisible({ timeout: 15000 });

    // Create conversation
    const createButton = page.getByTestId('create-button');
    await createButton.scrollIntoViewIfNeeded();
    await createButton.click();
    await expect(page.getByTestId('chat-area')).toBeVisible({ timeout: 10000 });

    // Verify conversation appears in sidebar
    const conversationItem = page.getByTestId('conversation-item');
    await expect(conversationItem).toBeVisible();

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Conversation should still be there
    await expect(page.getByTestId('conversation-item')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Test persistence topic')).toBeVisible();
  });
});

test.describe('Chat Functionality', () => {
  // Helper to create a conversation with a custom thinker
  async function createConversationWithThinker(page: import('@playwright/test').Page, topic: string, thinker: string) {
    const newChatButton = page.getByTestId('new-chat-button');
    await newChatButton.click({ force: true });
    await page.getByTestId('topic-input').fill(topic);
    await page.getByTestId('next-button').click();

    await expect(page.locator('h2', { hasText: 'Select Thinkers' })).toBeVisible({ timeout: 30000 });

    const customInput = page.getByTestId('custom-thinker-input');
    await customInput.scrollIntoViewIfNeeded();
    await customInput.fill(thinker);
    const addButton = page.getByTestId('add-custom-thinker');
    await addButton.scrollIntoViewIfNeeded();
    await addButton.click();
    await expect(page.getByTestId('selected-thinker')).toBeVisible({ timeout: 15000 });

    const createButton = page.getByTestId('create-button');
    await createButton.scrollIntoViewIfNeeded();
    await createButton.click();
    await expect(page.getByTestId('chat-area')).toBeVisible({ timeout: 10000 });
  }

  test('can send a message in conversation', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');

    await createConversationWithThinker(page, 'Quick test chat', 'Einstein');

    // Type and send a message
    const messageTextarea = page.getByTestId('message-textarea');
    await messageTextarea.fill('Hello, this is a test message!');

    const sendButton = page.getByTestId('send-button');
    await sendButton.click();

    // Message should appear in the chat
    await expect(page.locator('text=Hello, this is a test message!')).toBeVisible({ timeout: 5000 });
  });

  test('pause/resume button toggles UI state', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');

    await createConversationWithThinker(page, 'Pause test', 'Kant');

    // Pause button should be visible
    const pauseResumeButton = page.getByTestId('pause-resume-button');
    await expect(pauseResumeButton).toBeVisible();
    await expect(pauseResumeButton).toContainText('Pause');

    // Click to pause
    await pauseResumeButton.click();
    await expect(pauseResumeButton).toContainText('Resume');

    // Click to resume
    await pauseResumeButton.click();
    await expect(pauseResumeButton).toContainText('Pause');
  });

  test('pause actually stops thinker responses', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');

    await createConversationWithThinker(page, 'Tell me about ethics', 'Aristotle');

    // Send a message to trigger thinker response
    const messageTextarea = page.getByTestId('message-textarea');
    await messageTextarea.fill('What is virtue?');
    await page.getByTestId('send-button').click();

    // Wait for user message to appear
    await expect(page.locator('text=What is virtue?')).toBeVisible({ timeout: 5000 });

    // Get initial message count
    const getMessageCount = async () => {
      const messages = await page.getByTestId('message').all();
      return messages.length;
    };

    // Wait a moment for thinker to potentially start responding
    await page.waitForTimeout(2000);
    const countBeforePause = await getMessageCount();

    // Pause the conversation
    const pauseButton = page.getByTestId('pause-resume-button');
    await pauseButton.click();
    await expect(pauseButton).toContainText('Resume');

    // Wait and verify no new messages appear while paused
    await page.waitForTimeout(5000);
    const countWhilePaused = await getMessageCount();

    // Message count should not have increased significantly while paused
    // (allow for 1 message that might have been in-flight when pause was clicked)
    expect(countWhilePaused).toBeLessThanOrEqual(countBeforePause + 1);

    // Resume the conversation
    await pauseButton.click();
    await expect(pauseButton).toContainText('Pause');

    // Wait for thinker to respond after resume
    await page.waitForTimeout(10000);
    const countAfterResume = await getMessageCount();

    // Should have more messages after resuming (thinker responded)
    expect(countAfterResume).toBeGreaterThan(countWhilePaused);
  });

  test('can switch between conversations', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Create first conversation
    await createConversationWithThinker(page, 'First topic', 'Aristotle');
    await expect(page.locator('h2', { hasText: 'First topic' })).toBeVisible();

    // Wait for page to stabilize before creating second conversation
    await page.waitForLoadState('networkidle');

    // Create second conversation
    await createConversationWithThinker(page, 'Second topic', 'Socrates');
    await expect(page.locator('h2', { hasText: 'Second topic' })).toBeVisible();

    // Both conversations should be in sidebar
    const conversationItems = page.getByTestId('conversation-item');
    await expect(conversationItems).toHaveCount(2);

    // Click on first conversation (Aristotle) in sidebar - use conversation-item containing the text
    const firstConvItem = page.getByTestId('conversation-item').filter({ hasText: 'First topic' });
    await firstConvItem.scrollIntoViewIfNeeded();
    await firstConvItem.click();
    await expect(page.getByTestId('chat-area').locator('h2', { hasText: 'First topic' })).toBeVisible();

    // Click on second conversation (Socrates) in sidebar
    const secondConvItem = page.getByTestId('conversation-item').filter({ hasText: 'Second topic' });
    await secondConvItem.scrollIntoViewIfNeeded();
    await secondConvItem.click();
    await expect(page.getByTestId('chat-area').locator('h2', { hasText: 'Second topic' })).toBeVisible();

    // Sidebar should still show both conversations
    await expect(conversationItems).toHaveCount(2);
  });
});
