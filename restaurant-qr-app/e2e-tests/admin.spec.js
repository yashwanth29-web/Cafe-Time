const { test, expect } = require('@playwright/test');

test.describe('Admin and Staff Flow', () => {
  test('should load the login page and show auth options', async ({ page }) => {
    // 1. Navigate to the login page
    await page.goto('/login');

    // 2. Verify we are on the login page
    await expect(page).toHaveTitle(/Dr. Chai Cafe/);
    
    // We expect some form of login button, either Google Login or an Email field
    // Just verify that the login container is visible
    const loginContainer = page.locator('.login-container');
    if (await loginContainer.isVisible()) {
      await expect(loginContainer).toBeVisible();
    } else {
      // Fallback: Check if there's any text like 'Sign In' or 'Login'
      await expect(page.getByText(/Sign In|Login/i).first()).toBeVisible();
    }
  });
});
