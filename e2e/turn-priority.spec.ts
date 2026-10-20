import { expect, test, type Page } from '@playwright/test';
import { americanHistoryAPack as pack } from '../src/games/trivia/packs/american-history-a';

// Real server, three phones, host and TV: the turn player gets first chance, others line up, Pass hands it on.
test('turn player first chance, buzz line, pass and the +5s clue timer with three phones', async ({ browser, baseURL }, testInfo) => {
  test.setTimeout(120_000);
  const hostContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext({ viewport: { width: 390, height: 844 } })));
  const displayContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const host = await hostContext.newPage();
  host.setDefaultTimeout(10_000);
  const phones = await Promise.all(contexts.map((context) => context.newPage()));
  const display = await displayContext.newPage();
  const names = ['Ava', 'Ben', 'Cy'];
  const [ava, ben, cy] = phones;
  const scoreOf = (phone: Page) => phone.locator('[data-player-score]');
  // The live buzzer pulses continuously; use a real pointer click without waiting for animation stability.
  const pressBuzzer = (phone: Page) => phone.locator('.buzzer-button-v2').click({ force: true });

  async function openClue(index: number) {
    const tile = host.locator('.showcase-board-stage > .board .question-tile[data-question-id]:not(.used)').nth(index);
    const id = await tile.getAttribute('data-question-id');
    const question = pack.questions.find((candidate) => candidate.id === id)!;
    await tile.click();
    await expect(host.locator('.question-card-v2 h1')).toHaveText(question.text);
    // Reading time is unchanged: nobody can buzz before the buzzers open.
    await expect(host.locator('.countdown-panel')).toBeVisible();
    for (const phone of phones) await expect(phone.locator('.buzzer-button-v2')).toBeDisabled();
    await host.getByRole('button', { name: 'Open Buzzers Now', exact: true }).click();
    return question;
  }

  try {
    await host.goto(`${baseURL}/?mode=host&fresh=1`);
    await host.getByRole('button', { name: new RegExp(pack.title) }).click();
    await host.getByRole('combobox', { name: /^Game length/ }).selectOption('quick');
    await host.getByLabel('Daily Doubles', { exact: true }).fill('0');
    await host.getByRole('combobox', { name: /^Answer timer/ }).selectOption('15');
    const credentials = await host.evaluate(() => JSON.parse(localStorage.getItem('blue-stage-host-room')!) as { roomCode: string; presentationUrl: string });
    for (const [index, phone] of phones.entries()) {
      await phone.goto(`${baseURL}/?mode=player&room=${credentials.roomCode}`);
      await phone.getByLabel('Room code').fill(credentials.roomCode);
      await phone.getByLabel('Your name').fill(names[index]);
      await phone.getByRole('button', { name: 'Join Game' }).click();
      await expect(host.locator('.roster-row').getByText(names[index], { exact: true })).toBeVisible();
    }
    await display.goto(credentials.presentationUrl);
    await host.getByRole('button', { name: 'Start Game', exact: true }).click();
    await expect(ava.getByText('You pick.')).toBeVisible();

    // Clue 1: Ava's turn. Cy and Ben buzz in line, Ava passes, Cy answers wrong. No steal.
    const first = await openClue(0);
    await expect(ava.locator('.priority-note-phone.mine')).toContainText('FIRST CHANCE');
    await expect(ava.getByRole('button', { name: 'Pass', exact: true })).toBeVisible();
    await expect(ben.getByRole('button', { name: 'Pass', exact: true })).toHaveCount(0);
    await expect(ben.locator('.priority-note-phone')).toContainText('AVA HAS FIRST CHANCE');
    const seconds = Number(await host.locator('.question-card-v2 .timer span').textContent());
    expect(seconds).toBeGreaterThan(15);
    expect(seconds).toBeLessThanOrEqual(20);
    await pressBuzzer(cy);
    await expect(cy.locator('.buzzer-button-v2')).toHaveText('IN LINE #1');
    await pressBuzzer(ben);
    await expect(ben.locator('.buzzer-button-v2')).toHaveText('IN LINE #2');
    await expect(host.locator('.winner-chip')).toHaveCount(0);
    await expect(host.locator('.buzz-priority-status')).toContainText('Ava has first chance');
    await expect(host.locator('.buzz-priority-status')).toContainText('In line: Cy, Ben');
    await expect(display.locator('.buzz-priority-status')).toContainText('In line: Cy, Ben');
    for (const phone of phones) await expect(phone.getByText(first.acceptedAnswers[0], { exact: true })).toHaveCount(0);
    await host.screenshot({ path: testInfo.outputPath('host-first-chance.png') });
    await ava.screenshot({ path: testInfo.outputPath('turn-phone-first-chance.png') });
    await ben.screenshot({ path: testInfo.outputPath('phone-in-line.png') });
    expect(await ava.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    // Pass stays fully on screen and clear of the corner text-size button.
    const passBox = (await ava.getByRole('button', { name: 'Pass', exact: true }).boundingBox())!;
    const textSizeBox = (await ava.locator('.phone-accessibility-trigger').boundingBox())!;
    expect(passBox.y + passBox.height).toBeLessThanOrEqual(844);
    const overlaps = passBox.x < textSizeBox.x + textSizeBox.width && textSizeBox.x < passBox.x + passBox.width
      && passBox.y < textSizeBox.y + textSizeBox.height && textSizeBox.y < passBox.y + passBox.height;
    expect(overlaps).toBe(false);

    await ava.getByRole('button', { name: 'Pass', exact: true }).click();
    await expect(host.locator('.winner-chip')).toContainText('Cy');
    await expect(cy.locator('.buzzer-button-v2')).toHaveText('YOU’RE IN');
    await expect(ben.locator('.buzzer-button-v2')).toHaveText('LOCKED');
    await host.getByRole('button', { name: 'Reveal Answer', exact: true }).click();
    await host.getByRole('button', { name: 'Incorrect', exact: true }).click();
    await expect(scoreOf(cy)).toHaveText(String(-first.value));
    await expect(scoreOf(ava)).toHaveText('0');
    await expect(scoreOf(ben)).toHaveText('0');

    // Clue 2: rotation is unchanged, so Ben picks. A buzz from Ava waits; Ben answers himself.
    await expect(ben.getByText('You pick.')).toBeVisible();
    const second = await openClue(0);
    await expect(ben.locator('.priority-note-phone.mine')).toBeVisible();
    await pressBuzzer(ava);
    await expect(ava.locator('.buzzer-button-v2')).toHaveText('IN LINE #1');
    await pressBuzzer(ben);
    await expect(host.locator('.winner-chip')).toContainText('Ben');
    await host.getByRole('button', { name: 'Reveal Answer', exact: true }).click();
    await host.getByRole('button', { name: 'Correct', exact: true }).click();
    await expect(scoreOf(ben)).toHaveText(String(second.value));
    await expect(scoreOf(ava)).toHaveText('0');

    // Clue 3: Cy's turn. Cy passes with nobody in line, then the first buzz answers.
    await expect(cy.getByText('You pick.')).toBeVisible();
    await openClue(0);
    await cy.getByRole('button', { name: 'Pass', exact: true }).click();
    await expect(host.locator('.buzz-priority-status')).toContainText('Cy passed');
    await expect(cy.locator('.buzzer-button-v2')).toBeDisabled();
    await pressBuzzer(ava);
    await expect(host.locator('.winner-chip')).toContainText('Ava');
  } finally {
    await displayContext.close();
    await Promise.all(contexts.map((context) => context.close()));
    await hostContext.close();
  }
});
