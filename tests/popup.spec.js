const { test, expect } = require('@playwright/test');

test.describe('Bookmark Manager Popup', () => {
  test.beforeEach(async ({ page }) => {
    // Mock chrome API
    await page.evaluate(() => {
      // Mock chrome.storage
      chrome.storage = {
        sync: {
          get: async (keys) => {
            // Return default config
            return {
              apiProvider: 'kimi',
              apiKey: '',
              model: 'kimi-k2-0711-preview'
            };
          },
          set: async (data) => {
            console.log('Chrome storage set:', data);
          }
        },
        local: {
          get: async (keys) => {
            return { organizing: false };
          },
          set: async (data) => {
            console.log('Chrome local storage set:', data);
          }
        }
      };

      // Mock chrome.bookmarks
      chrome.bookmarks = {
        getTree: async (callback) => {
          callback([{
            id: '0',
            title: 'Bookmarks Bar',
            children: []
          }]);
        },
        getChildren: async (id, callback) => {
          callback([]);
        },
        create: async (data) => data,
        move: async (id, data) => data,
        update: async (id, data) => data,
        remove: async (id) => {},
        removeTree: async (id) => {}
      };

      // Mock chrome.tabs
      chrome.tabs = {
        create: async (data) => {
          console.log('Create tab:', data);
        }
      };

      // Mock chrome.runtime
      chrome.runtime = {
        openOptionsPage: async () => {
          console.log('Open options page');
        },
        getManifest: () => ({
          version: '1.0.0',
          name: '智能书签整理器',
          homepage_url: 'https://example.com'
        }),
        lastError: null
      };
    });
  });

  test('should show home view by default', async ({ page }) => {
    await page.goto('popup.html');

    // Check home view is visible
    await expect(page.locator('#homeView')).toBeVisible();
    await expect(page.locator('#settingsView')).toBeHidden();

    // Check header shows "智能书签整理器"
    await expect(page.locator('#popupHeader h1')).toContainText('智能书签整理器');
  });

  test('should switch to settings view when clicking settings button', async ({ page }) => {
    await page.goto('popup.html');

    // Click settings button
    await page.click('#openSettings');

    // Check settings view is visible
    await expect(page.locator('#settingsView')).toBeVisible();
    await expect(page.locator('#homeView')).toBeHidden();

    // Check button changed to back icon
    await expect(page.locator('#openSettings')).toBeVisible();
  });

  test('should switch back to home view when clicking back button', async ({ page }) => {
    await page.goto('popup.html');

    // Go to settings first
    await page.click('#openSettings');
    await expect(page.locator('#settingsView')).toBeVisible();

    // Click back button
    await page.click('#openSettings');

    // Check home view is visible again
    await expect(page.locator('#homeView')).toBeVisible();
    await expect(page.locator('#settingsView')).toBeHidden();
  });

  test('should show message when API is not configured', async ({ page }) => {
    await page.evaluate(() => {
      chrome.storage.sync.get = async () => ({});
    });

    await page.goto('popup.html');

    // Click start button without API
    await page.click('#startOrganize');

    // Should show error message
    await expect(page.locator('.message.error')).toContainText('请先配置 API');
  });

  test('should toggle API key visibility', async ({ page }) => {
    await page.goto('popup.html');
    await page.click('#openSettings');

    // Type in API key
    await page.fill('#apiKey', 'test-api-key');

    // Toggle visibility
    await page.click('#toggleKey');
    await expect(page.locator('#apiKey')).toHaveAttribute('type', 'text');

    // Toggle back
    await page.click('#toggleKey');
    await expect(page.locator('#apiKey')).toHaveAttribute('type', 'password');
  });

  test('should update model options when provider changes', async ({ page }) => {
    await page.goto('popup.html');
    await page.click('#openSettings');

    // Change provider to Claude
    await page.selectOption('#apiProvider', 'claude');

    // Claude models should be visible
    await expect(page.locator('#model option[value="claude-3-5-sonnet-20241022"]')).toBeVisible();
  });
});
