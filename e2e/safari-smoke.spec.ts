import { expect, test } from '@playwright/test';

test('WebKit boots the menu and Join Game screen without runtime errors', async ({ page, browserName }) => {
  test.skip(browserName !== 'webkit');

  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await expect(page.locator('.showcase-menu')).toBeVisible();
  await page.getByRole('button', { name: /Join a Game/i }).click();
  await expect(page.locator('.phone-shell.phone-join')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Join Game' })).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test('WebKit tolerates simulated page-cache, visibility, and network recovery events', async ({ page, browserName }) => {
  test.skip(browserName !== 'webkit');
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/?mode=player');
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('online'));
  });
  await expect(page.locator('.phone-shell.phone-join')).toBeVisible();
  expect(pageErrors).toEqual([]);
});
