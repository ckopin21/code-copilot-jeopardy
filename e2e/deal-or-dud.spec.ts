import { expect, test, type Page } from '@playwright/test';

async function joinPhone(page: Page, roomKey: string, name: string) {
  await page.goto('/');
  await page.getByLabel(/room key/i).fill(roomKey);
  await page.getByRole('button', { name: 'Join' }).click();
  await page.getByPlaceholder('Name').fill(name);
  await page.getByRole('button', { name: /pick your look/i }).click();
  await page.getByRole('option').first().click();
  await page.getByRole('button', { name: 'Enter the studio' }).click();
  await expect(page.getByText(`You're in, ${name}!`)).toBeVisible();
}

test('the root shows the game picker with both games', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Blue Stage Games' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Blue Stage Trivia/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Deal or Dud/ })).toBeVisible();
});

test('Deal or Dud: four phones join by room key and the host starts round one', async ({ browser, baseURL }) => {
  test.setTimeout(90_000);
  const hostContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const host = await hostContext.newPage();
  const pageErrors: string[] = [];
  host.on('pageerror', (error) => pageErrors.push(error.message));
  await host.goto(`${baseURL}/?game=deal-or-dud&mode=host`);
  const roomKey = (await host.locator('.dod-room-key b').textContent())?.trim() ?? '';
  expect(roomKey).toMatch(/^[A-Z0-9]{4}$/);

  const phones: Page[] = [];
  for (const name of ['Ava', 'Ben', 'Cy', 'Di']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const phone = await context.newPage();
    phone.on('pageerror', (error) => pageErrors.push(error.message));
    await joinPhone(phone, roomKey, name);
    phones.push(phone);
  }
  await expect(host.getByText('All four players are in the studio!')).toBeVisible();

  await host.getByRole('button', { name: 'Settings & start' }).click();
  await host.getByLabel(/narrated tutorial/i).click();
  await expect(host.getByLabel(/narrated tutorial/i)).not.toBeChecked();
  await host.getByRole('button', { name: 'Confirm & start game' }).click();

  // Everyone builds at once before round 1: three quick card picks.
  for (const phone of phones) await expect(phone.getByRole('heading', { name: 'Pick a product' })).toBeVisible();
  const noScroll = async (phone: Page) => expect(await phone.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(true);
  const builder = phones[1];
  await builder.locator('.dod-pick-card').first().click();
  await expect(builder.getByRole('heading', { name: 'Add a twist' })).toBeVisible();
  await expect(builder.locator('.dod-pick-card')).toHaveCount(4);
  await builder.getByRole('button', { name: '🔀 New cards' }).click();
  await builder.locator('.dod-pick-card').nth(1).click();
  await expect(builder.getByRole('heading', { name: 'Who is it for?' })).toBeVisible();
  await noScroll(builder);
  await builder.locator('.dod-pick-card').nth(2).click();
  await expect(builder.getByText('Business name')).toBeVisible();
  await expect(builder.locator('.dod-headline-preview b')).toHaveText(/ for /);
  await noScroll(builder);
  await expect(host.getByText('Everyone builds')).toBeVisible();
  await expect(host.locator('.dod-banner-count')).toHaveText('Locked in 0/4');
  for (const phone of phones.slice(2)) for (let i = 0; i < 3; i += 1) await phone.locator('.dod-pick-card').first().click();
  for (const phone of phones.slice(1)) {
    await phone.getByRole('button', { name: /Lock it in/ }).click();
    await expect(phone.getByText(/Locked in 🔒 · you pitch in round/)).toBeVisible();
  }
  await expect(host.locator('.dod-banner-count')).toHaveText('Locked in 3/4');
  // Nobody's product shows on the TV before its pitch.
  await expect(host.locator('.dod-headline h1')).toHaveText('Everyone is building a business…');
  for (const phone of [phones[0], phones[1]]) await noScroll(phone);

  for (const title of ['Pick a product', 'Add a twist', 'Who is it for?']) {
    await expect(phones[0].getByRole('heading', { name: title })).toBeVisible();
    await phones[0].locator('.dod-pick-card').first().click();
  }
  await phones[0].getByRole('button', { name: /Lock it in/ }).click();
  // The last lock starts round 1 on stage: the first to join presents and sees the secret verdict and all four checks.
  await expect(host.getByText('Round 1 of 4 · On stage')).toBeVisible();
  await expect(phones[0].getByText(/^(GOOD|BAD) business/)).toBeVisible();
  await expect(phones[0].locator('.dod-check-row b')).toHaveCount(4);
  // The TV shows four secret tiles, the headline, and never the verdict.
  await expect(host.locator('.dod-tile')).toHaveCount(4);
  await expect(host.locator('.dod-tile-secret')).toHaveCount(4);
  await expect(host.locator('.dod-headline h1')).not.toHaveText('');
  await expect(host.getByText(/GOOD business|BAD business/)).toHaveCount(0);

  // A shark peeks (tap, then tap again): only that phone sees the answer; the TV and the other sharks see who peeked.
  const shark = phones[1];
  await shark.getByRole('button', { name: /Does it make money\?/ }).click();
  await expect(shark.getByText('Tap again to peek 👀')).toBeVisible();
  await shark.getByRole('button', { name: /Does it make money\?/ }).click();
  await expect(shark.getByText(/Only you see this/)).toBeVisible();
  await expect(shark.locator('.dod-my-peek b')).toHaveText(/^(✅|❌) /);
  await expect(host.locator('[data-category="money"] .dod-tile-peeks')).toHaveText('👀 Ben peeked');
  await expect(host.locator('.dod-tile-secret')).toHaveCount(4);
  await expect(phones[2].getByText(/Only you see this/)).toHaveCount(0);
  await expect(phones[2].getByRole('button', { name: /Does it make money\?.*Ben/ })).toBeVisible();
  await expect(phones[0].getByText('· 👀 Ben')).toBeVisible();
  // Phone screens fit without page scrolling.
  for (const phone of [phones[0], phones[1], phones[2]]) await noScroll(phone);

  expect(pageErrors).toEqual([]);
  await hostContext.close();
});
