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

  // Everyone builds at once before round 1.
  for (const phone of phones) await expect(phone.getByText('Pick anything, or nothing!')).toBeVisible();
  await expect(host.getByText('Everyone builds')).toBeVisible();
  await expect(host.locator('.dod-banner-count')).toHaveText('Locked in 0/4');
  for (const phone of phones.slice(1)) {
    await phone.getByRole('button', { name: /Lock it in/ }).click();
    await expect(phone.getByText(/Locked in 🔒 · you pitch in round/)).toBeVisible();
  }
  await expect(host.locator('.dod-banner-count')).toHaveText('Locked in 3/4');
  // Nobody's product shows on the TV before its pitch.
  await expect(host.locator('.dod-headline h1')).toHaveText('Everyone is building a business…');
  for (const phone of [phones[0], phones[1]]) {
    expect(await phone.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(true);
  }

  await phones[0].getByRole('button', { name: /Lock it in/ }).click();
  // The last lock starts round 1: the first to join presents and now sees the secret verdict; the TV gets the three good facts.
  await expect(host.getByText('Round 1 of 4 · Pitch')).toBeVisible();
  await expect(phones[0].getByText(/^(GOOD|BAD) business/)).toBeVisible();
  await expect(phones[0].getByRole('button', { name: /Done pitching/ })).toBeVisible();
  await expect(host.locator('.dod-board .dod-card')).toHaveCount(3);
  await expect(phones[1].getByRole('tab', { name: 'Facts on TV (3/6)' })).toBeVisible();
  // The TV shows the headline but never the verdict.
  await expect(host.locator('.dod-headline h1')).not.toHaveText('');
  await expect(host.getByText(/GOOD business|BAD business/)).toHaveCount(0);
  // Phone screens fit without page scrolling.
  for (const phone of [phones[0], phones[1]]) {
    expect(await phone.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(true);
  }

  expect(pageErrors).toEqual([]);
  await hostContext.close();
});
