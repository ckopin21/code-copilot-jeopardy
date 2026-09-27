import { expect, test, type Page } from '@playwright/test';

async function joinPhone(page: Page, roomKey: string, name: string) {
  await page.goto('/');
  await page.getByLabel(/room key/i).fill(roomKey);
  await page.getByRole('button', { name: 'Join' }).click();
  await page.getByPlaceholder('Name').fill(name);
  await page.getByRole('button', { name: /pick your look/i }).click();
  await page.getByRole('option').first().click();
  await page.getByRole('button', { name: 'Join the tank' }).click();
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
  for (const phone of phones) await expect(phone.getByRole('heading', { name: 'Pick a twist' })).toBeVisible();
  const noScroll = async (phone: Page) => expect(await phone.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(true);
  const builder = phones[1];
  await builder.locator('.dod-pick-card').first().click();
  await expect(builder.getByRole('heading', { name: 'Pick a product' })).toBeVisible();
  await expect(builder.locator('.dod-pick-card')).toHaveCount(6);
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

  for (const title of ['Pick a twist', 'Pick a product', 'Who is it for?']) {
    await expect(phones[0].getByRole('heading', { name: title })).toBeVisible();
    await phones[0].locator('.dod-pick-card').first().click();
  }
  await phones[0].getByRole('button', { name: /Lock it in/ }).click();
  // The last lock starts round 1 on stage with pitch time: the product goes up big on the TV, the presenter's phone
  // shows the product and the clock, and the sharks have no buttons yet.
  await expect(host.getByText('Round 1 of 4 · On stage')).toBeVisible();
  await expect(host.locator('.dod-product-card.is-stage-big b')).not.toHaveText('');
  await expect(host.getByText(/Pitch time! Ava has the floor/)).toBeVisible();
  await expect(phones[0].locator('.dod-product-card b')).not.toHaveText('');
  await expect(phones[0].locator('.dod-big-clock small')).toHaveText('Pitch time');
  const shark = phones[1];
  await expect(shark.getByRole('heading', { name: 'Pitch time. Just listen!' })).toBeVisible();
  await expect(shark.getByRole('button', { name: /React/ })).toHaveCount(0);
  await expect(shark.getByRole('button', { name: /Ready to bid/ })).toHaveCount(0);

  // The host skips pitch time: questions open, and the sharks get reactions, I'm out and Ready to bid.
  await host.getByRole('button', { name: 'Skip to questions ▶▶' }).click();
  await expect(host.getByText(/Questions open! Sharks: ask anything/)).toBeVisible();
  await expect(host.locator('.dod-product-card.is-stage-corner')).toBeVisible();
  await shark.getByRole('button', { name: 'React 😂' }).click();
  await expect(host.locator('.dod-float')).toHaveCount(1);
  const bailer = phones[2];
  await bailer.getByRole('button', { name: "I'm out!" }).click();
  await bailer.getByRole('button', { name: /Tap again/ }).click();
  await expect(host.locator('.dod-out-sting')).toHaveText(/Cy is out!/);
  await expect(host.getByText('Out: Cy')).toBeVisible();
  await expect(bailer.getByText('Your bid is locked at $0.')).toBeVisible();
  await expect(shark.getByRole('button', { name: 'Ready to bid (0/2)' })).toBeVisible();
  // Phone screens fit without page scrolling.
  for (const phone of [phones[0], phones[1], phones[2]]) await noScroll(phone);

  // Both sharks still in get ready: secret bids, with labels.
  await shark.getByRole('button', { name: 'Ready to bid (0/2)' }).click();
  await phones[3].getByRole('button', { name: /Ready to bid/ }).click();
  await expect(shark.getByRole('heading', { name: 'Your secret bid' })).toBeVisible();
  await expect(bailer.getByRole('heading', { name: "You're out 🚪" })).toBeVisible();
  await shark.getByRole('button', { name: /\$500K.*Take my money/ }).click();
  await shark.getByRole('button', { name: 'Lock in $500K' }).click();
  await noScroll(shark);
  await phones[3].getByRole('button', { name: /\$300K/ }).click();
  await phones[3].getByRole('button', { name: 'Lock in $300K' }).click();
  // The reveal flips the bids lowest first, then the total.
  await expect(host.getByText('Round 1 of 4 · The reveal')).toBeVisible();
  await expect(host.locator('.dod-total')).toHaveText('$800K raised!', { timeout: 10_000 });
  await expect(host.locator('.dod-deal-line')).toHaveText(/Ben is in!/);
  await expect(phones[0].locator('.dod-phone-reveal .dod-big').last()).toHaveText(/^\+8 Raised \$800K/);

  expect(pageErrors).toEqual([]);
  await hostContext.close();
});
