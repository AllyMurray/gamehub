import { test, expect, Page, Browser } from '@playwright/test';

/**
 * E2E tests for multiplayer connection functionality.
 *
 * These tests use isolated browser contexts to simulate two players:
 * - Host: Creates a game session
 * - Viewer: Joins the game session using the session code
 *
 * Tests verify that session codes work correctly, including:
 * - Basic connection flow
 * - Unicode character normalization (dashes, look-alike characters)
 * - Connection status updates
 */

test.describe('Multiplayer Connection', () => {
  test.describe.configure({ mode: 'serial' });

  let hostPage: Page;
  let viewerPage: Page;

  test.beforeEach(async ({ browser }) => {
    // Create two isolated browser contexts
    const hostContext = await browser.newContext();
    const viewerContext = await browser.newContext();

    hostPage = await hostContext.newPage();
    viewerPage = await viewerContext.newPage();
  });

  test.afterEach(async () => {
    await hostPage.context().close();
    await viewerPage.context().close();
  });

  test('should allow viewer to join hosted game using session code', async () => {
    // Host navigates to the app
    await hostPage.goto('/');
    await expect(hostPage.locator('.lobby-title')).toBeVisible();

    // Host clicks "Host Game" and then "Host" to start without PIN
    await hostPage.click('button:has-text("Host Game")');
    await hostPage.click('button:has-text("Host"):not(:has-text("with PIN"))');

    // Wait for session code to appear
    await expect(hostPage.locator('.session-code')).toBeVisible({ timeout: 10000 });
    const sessionCode = await hostPage.locator('.session-code').textContent();
    expect(sessionCode).toBeTruthy();
    expect(sessionCode).toMatch(/^[A-Z0-9]{6}-[a-f0-9]{6}$/);

    // Host should see "Waiting for partner..."
    await expect(hostPage.locator('.partner-status.waiting')).toContainText('Waiting for partner');

    // Viewer navigates to the app
    await viewerPage.goto('/');
    await expect(viewerPage.locator('.lobby-title')).toBeVisible();

    // Viewer clicks "Join Game" and enters the session code
    await viewerPage.click('button:has-text("Join Game")');
    await viewerPage.fill('#join-code', sessionCode!);

    // Verify the code is properly displayed in the input
    const inputValue = await viewerPage.locator('#join-code').inputValue();
    expect(inputValue).toBe(sessionCode);

    // Click Join button
    await viewerPage.click('button:has-text("Join"):not(:has-text("Game"))');

    // Wait for connection on both sides
    await expect(hostPage.locator('.partner-status.connected')).toContainText('Partner connected', { timeout: 15000 });
    await expect(viewerPage.locator('.viewer-label')).toContainText('Playing with partner', { timeout: 15000 });

    // Verify the game board is visible on both sides
    await expect(hostPage.locator('.board')).toBeVisible();
    await expect(viewerPage.locator('.board')).toBeVisible();
  });

  test('should allow joining via URL with session code', async () => {
    // Host creates a game
    await hostPage.goto('/');
    await hostPage.click('button:has-text("Host Game")');
    await hostPage.click('button:has-text("Host"):not(:has-text("with PIN"))');

    // Wait for session code
    await expect(hostPage.locator('.session-code')).toBeVisible({ timeout: 10000 });
    const sessionCode = await hostPage.locator('.session-code').textContent();

    // Viewer navigates directly with the join code in URL
    await viewerPage.goto(`/?join=${sessionCode}`);

    // The join form should be pre-populated and shown
    await expect(viewerPage.locator('#join-code')).toHaveValue(sessionCode!);

    // Click Join
    await viewerPage.click('button:has-text("Join"):not(:has-text("Game"))');

    // Verify connection
    await expect(hostPage.locator('.partner-status.connected')).toContainText('Partner connected', { timeout: 15000 });
    await expect(viewerPage.locator('.viewer-label')).toContainText('Playing with partner', { timeout: 15000 });
  });

  test('should handle session code with Unicode en-dash (WhatsApp substitution)', async () => {
    // Host creates a game
    await hostPage.goto('/');
    await hostPage.click('button:has-text("Host Game")');
    await hostPage.click('button:has-text("Host"):not(:has-text("with PIN"))');

    await expect(hostPage.locator('.session-code')).toBeVisible({ timeout: 10000 });
    const sessionCode = await hostPage.locator('.session-code').textContent();

    // Simulate WhatsApp substitution: replace hyphen-minus with en-dash (U+2013)
    const codeWithEnDash = sessionCode!.replace('-', '\u2013');

    // Viewer joins with the modified code
    await viewerPage.goto('/');
    await viewerPage.click('button:has-text("Join Game")');
    await viewerPage.fill('#join-code', codeWithEnDash);

    // The input should normalize the en-dash to hyphen-minus
    const inputValue = await viewerPage.locator('#join-code').inputValue();
    expect(inputValue).toBe(sessionCode);

    // Join should work
    await viewerPage.click('button:has-text("Join"):not(:has-text("Game"))');

    await expect(hostPage.locator('.partner-status.connected')).toContainText('Partner connected', { timeout: 15000 });
  });

  test('should handle session code with Cyrillic look-alike characters', async () => {
    // Host creates a game
    await hostPage.goto('/');
    await hostPage.click('button:has-text("Host Game")');
    await hostPage.click('button:has-text("Host"):not(:has-text("with PIN"))');

    await expect(hostPage.locator('.session-code')).toBeVisible({ timeout: 10000 });
    const sessionCode = await hostPage.locator('.session-code').textContent();

    // Create a mapping of Latin to Cyrillic look-alikes
    const latinToCyrillic: Record<string, string> = {
      'A': '\u0410', // Cyrillic А
      'B': '\u0412', // Cyrillic В
      'C': '\u0421', // Cyrillic С
      'E': '\u0415', // Cyrillic Е
      'H': '\u041D', // Cyrillic Н
      'K': '\u041A', // Cyrillic К
      'M': '\u041C', // Cyrillic М
      'P': '\u0420', // Cyrillic Р
      'T': '\u0422', // Cyrillic Т
      'X': '\u0425', // Cyrillic Х
      'a': '\u0430', // Cyrillic а
      'c': '\u0441', // Cyrillic с
      'e': '\u0435', // Cyrillic е
    };

    // Substitute some Latin characters with Cyrillic look-alikes
    let codeWithCyrillic = '';
    for (const char of sessionCode!) {
      codeWithCyrillic += latinToCyrillic[char] ?? char;
    }

    // Viewer joins with the modified code
    await viewerPage.goto('/');
    await viewerPage.click('button:has-text("Join Game")');
    await viewerPage.fill('#join-code', codeWithCyrillic);

    // The input should normalize Cyrillic to Latin
    const inputValue = await viewerPage.locator('#join-code').inputValue();
    expect(inputValue).toBe(sessionCode);

    // Join should work
    await viewerPage.click('button:has-text("Join"):not(:has-text("Game"))');

    await expect(hostPage.locator('.partner-status.connected')).toContainText('Partner connected', { timeout: 15000 });
  });

  test('should handle session code with fullwidth characters (Asian keyboard)', async () => {
    // Host creates a game
    await hostPage.goto('/');
    await hostPage.click('button:has-text("Host Game")');
    await hostPage.click('button:has-text("Host"):not(:has-text("with PIN"))');

    await expect(hostPage.locator('.session-code')).toBeVisible({ timeout: 10000 });
    const sessionCode = await hostPage.locator('.session-code').textContent();

    // Convert to fullwidth characters
    let codeWithFullwidth = '';
    for (const char of sessionCode!) {
      const code = char.charCodeAt(0);
      if (code >= 0x41 && code <= 0x5A) {
        // Uppercase A-Z -> Fullwidth A-Z (U+FF21 to U+FF3A)
        codeWithFullwidth += String.fromCharCode(code - 0x41 + 0xFF21);
      } else if (code >= 0x61 && code <= 0x7A) {
        // Lowercase a-z -> Fullwidth a-z (U+FF41 to U+FF5A)
        codeWithFullwidth += String.fromCharCode(code - 0x61 + 0xFF41);
      } else if (code >= 0x30 && code <= 0x39) {
        // Digits 0-9 -> Fullwidth 0-9 (U+FF10 to U+FF19)
        codeWithFullwidth += String.fromCharCode(code - 0x30 + 0xFF10);
      } else if (char === '-') {
        // Hyphen -> Fullwidth hyphen-minus (U+FF0D)
        codeWithFullwidth += '\uFF0D';
      } else {
        codeWithFullwidth += char;
      }
    }

    // Viewer joins with fullwidth code
    await viewerPage.goto('/');
    await viewerPage.click('button:has-text("Join Game")');
    await viewerPage.fill('#join-code', codeWithFullwidth);

    // The input should normalize fullwidth to ASCII
    const inputValue = await viewerPage.locator('#join-code').inputValue();
    expect(inputValue).toBe(sessionCode);

    // Join should work
    await viewerPage.click('button:has-text("Join"):not(:has-text("Game"))');

    await expect(hostPage.locator('.partner-status.connected')).toContainText('Partner connected', { timeout: 15000 });
  });

  test('should show error for invalid session code', async () => {
    await viewerPage.goto('/');
    await viewerPage.click('button:has-text("Join Game")');
    await viewerPage.fill('#join-code', 'INVALID-code00');

    // The Join button should be disabled for invalid codes
    const joinButton = viewerPage.locator('button:has-text("Join"):not(:has-text("Game"))');
    await expect(joinButton).toBeDisabled();
  });

  test('should show "Game not found" for non-existent session', async () => {
    await viewerPage.goto('/');
    await viewerPage.click('button:has-text("Join Game")');

    // Enter a valid format but non-existent session code
    await viewerPage.fill('#join-code', 'ABCDEF-123456');
    await viewerPage.click('button:has-text("Join"):not(:has-text("Game"))');

    // Should show connection error
    await expect(viewerPage.locator('.partner-status.error')).toContainText('Game not found', { timeout: 15000 });
  });

  test('should handle PIN-protected games', async () => {
    // Host creates a game with PIN
    await hostPage.goto('/');
    await hostPage.click('button:has-text("Host Game")');
    await hostPage.fill('#host-pin', '1234');
    await hostPage.click('button:has-text("Host with PIN")');

    await expect(hostPage.locator('.session-code')).toBeVisible({ timeout: 10000 });
    const sessionCode = await hostPage.locator('.session-code').textContent();

    // Verify PIN indicator is shown
    await expect(hostPage.locator('.session-pin-indicator')).toBeVisible();

    // Viewer tries to join without PIN - should fail
    await viewerPage.goto('/');
    await viewerPage.click('button:has-text("Join Game")');
    await viewerPage.fill('#join-code', sessionCode!);
    await viewerPage.click('button:has-text("Join"):not(:has-text("Game"))');

    // Should show auth failure
    await expect(viewerPage.locator('.partner-status.error')).toContainText('Incorrect PIN', { timeout: 15000 });

    // Close viewer and try again with correct PIN
    await viewerPage.context().close();
    const newViewerContext = await hostPage.context().browser()!.newContext();
    viewerPage = await newViewerContext.newPage();

    await viewerPage.goto('/');
    await viewerPage.click('button:has-text("Join Game")');
    await viewerPage.fill('#join-code', sessionCode!);
    await viewerPage.fill('#join-pin', '1234');
    await viewerPage.click('button:has-text("Join"):not(:has-text("Game"))');

    // Should connect successfully
    await expect(hostPage.locator('.partner-status.connected')).toContainText('Partner connected', { timeout: 15000 });
    await expect(viewerPage.locator('.viewer-label')).toContainText('Playing with partner', { timeout: 15000 });
  });

  test('should allow viewer to suggest words to host', async () => {
    // Set up connection
    await hostPage.goto('/');
    await hostPage.click('button:has-text("Host Game")');
    await hostPage.click('button:has-text("Host"):not(:has-text("with PIN"))');

    await expect(hostPage.locator('.session-code')).toBeVisible({ timeout: 10000 });
    const sessionCode = await hostPage.locator('.session-code').textContent();

    await viewerPage.goto('/');
    await viewerPage.click('button:has-text("Join Game")');
    await viewerPage.fill('#join-code', sessionCode!);
    await viewerPage.click('button:has-text("Join"):not(:has-text("Game"))');

    await expect(hostPage.locator('.partner-status.connected')).toContainText('Partner connected', { timeout: 15000 });

    // Viewer types a word suggestion
    await viewerPage.keyboard.type('HELLO');

    // Host should see the suggestion panel
    await expect(hostPage.locator('.suggestion-panel')).toBeVisible({ timeout: 5000 });
    await expect(hostPage.locator('.suggestion-word')).toContainText('HELLO');

    // Host accepts the suggestion
    await hostPage.click('.suggestion-btn.accept');

    // Viewer should see suggestion was accepted
    await expect(viewerPage.locator('.partner-status.connected')).toContainText('Suggestion accepted', { timeout: 5000 });
  });

  test('should copy link functionality works', async () => {
    await hostPage.goto('/');
    await hostPage.click('button:has-text("Host Game")');
    await hostPage.click('button:has-text("Host"):not(:has-text("with PIN"))');

    await expect(hostPage.locator('.session-code')).toBeVisible({ timeout: 10000 });

    // Grant clipboard permissions
    await hostPage.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    // Click copy link button
    await hostPage.click('button:has-text("Copy Link")');

    // Should show "Copied!" feedback
    await expect(hostPage.locator('button:has-text("Copied!")')).toBeVisible();

    // Read clipboard and verify it contains the session code
    const clipboardText = await hostPage.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('?join=');
    expect(clipboardText).toMatch(/\?join=[A-Z0-9]{6}-[a-f0-9]{6}$/);
  });
});

test.describe('Solo Game', () => {
  test('should allow playing solo without multiplayer', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Play Solo")');

    // Should show game board
    await expect(page.locator('.board')).toBeVisible();
    await expect(page.locator('.keyboard')).toBeVisible();

    // Should not show connection status
    await expect(page.locator('.connection-status')).not.toBeVisible();

    // Can type a word
    await page.keyboard.type('HELLO');

    // First row should show the typed letters
    const firstRow = page.locator('.row').first();
    await expect(firstRow).toContainText('HELLO');
  });
});
