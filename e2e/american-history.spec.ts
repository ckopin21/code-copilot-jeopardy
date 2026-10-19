import { expect, test } from '@playwright/test';
import { americanHistoryAPack } from '../src/games/trivia/packs/american-history-a';
import { americanHistoryBPack } from '../src/games/trivia/packs/american-history-b';

for (const pack of [americanHistoryAPack, americanHistoryBPack]) {
  test(`${pack.title}: choose, launch, buzz, reveal and score with three phones`, async ({ browser, baseURL }, testInfo) => {
    test.setTimeout(90_000);
    const hostContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext({ viewport: { width: 390, height: 844 } })));
    const displayContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const host = await hostContext.newPage();
    host.setDefaultTimeout(10_000);
    const phones = await Promise.all(contexts.map((context) => context.newPage()));
    const display = await displayContext.newPage();
    try {
      await host.goto(`${baseURL}/?mode=host&fresh=1`);
      const selectPack = host.getByRole('button', { name: new RegExp(pack.title) });
      await expect(selectPack).toBeVisible();
      for (const width of [390, 1440]) {
        await host.setViewportSize({ width, height: 900 });
        await selectPack.scrollIntoViewIfNeeded();
        await expect(selectPack).toContainText('42 questions');
        const bounds = await selectPack.boundingBox();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
        expect(await host.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        const clippedCards = await host.locator('.enhanced-pack-main').evaluateAll((buttons) => buttons.flatMap((button) => {
          const rect = button.getBoundingClientRect();
          const title = button.querySelector('strong')!;
          return rect.x < 0 || rect.right > innerWidth + 1 || title.scrollWidth > title.clientWidth + 1
            ? [button.textContent] : [];
        }));
        expect(clippedCards).toEqual([]);
        await host.screenshot({ path: testInfo.outputPath(`picker-${width}.png`) });
      }
      await selectPack.click();
      await expect(selectPack).toHaveAttribute('aria-pressed', 'true');
      await host.getByRole('combobox', { name: /^Game length/ }).selectOption('marathon');
      await host.getByLabel('Daily Doubles', { exact: true }).fill('0');
      await host.getByRole('combobox', { name: /^Answer timer/ }).selectOption('none');
      const credentials = await host.evaluate(() => JSON.parse(localStorage.getItem('blue-stage-host-room')!) as { roomCode: string; presentationUrl: string });
      const names = ['US teen', 'Spanish teen', 'Norwegian teen'];
      for (const [index, phone] of phones.entries()) {
        await phone.goto(`${baseURL}/?mode=player&room=${credentials.roomCode}`);
        await phone.getByLabel('Room code').fill(credentials.roomCode);
        await phone.getByLabel('Your name').fill(names[index]);
        await phone.getByRole('button', { name: 'Join Game' }).click();
        await expect(host.locator('.roster-row').getByText(names[index], { exact: true })).toBeVisible();
      }
      await display.goto(credentials.presentationUrl);
      await host.getByRole('button', { name: 'Start Game', exact: true }).click();
      const board = host.locator('.showcase-board-stage > .board');
      await expect(board.locator('.question-tile')).toHaveCount(36);
      await expect(board.locator(`.question-tile[data-question-id^="${pack.id}-"]`)).toHaveCount(36);
      const tile = board.locator('.question-tile').first();
      const id = await tile.getAttribute('data-question-id');
      const question = pack.questions.find((q) => q.id === id)!;
      await tile.click();
      await expect(host.locator('.question-card-v2 h1')).toHaveText(question.text);
      await expect(display.getByText(question.text, { exact: true })).toBeVisible();
      await host.screenshot({ path: testInfo.outputPath('host-clue.png') });
      await phones[0].screenshot({ path: testInfo.outputPath('phone-clue.png') });
      for (const phone of phones) await expect(phone.getByText(question.acceptedAnswers[0], { exact: true })).toHaveCount(0);
      await expect(display.locator('.presentation-answer')).toHaveCount(0);
      const buzzer = phones[0].getByRole('button', { name: 'BUZZ', exact: true });
      await expect(buzzer).toBeEnabled({ timeout: 20_000 });
      // The live buzzer pulses continuously; use a real pointer click without waiting for animation stability.
      await buzzer.click({ force: true });
      await expect(host.locator('.winner-chip')).toContainText(names[0]);
      await host.getByRole('button', { name: 'Reveal Answer', exact: true }).click();
      await expect(phones[0].getByText(question.acceptedAnswers[0], { exact: true })).toBeVisible();
      await expect(display.locator('.presentation-answer strong')).toHaveText(question.acceptedAnswers.join(' / '));
      await host.getByRole('button', { name: 'Correct', exact: true }).click();
      await expect(phones[0].locator('[data-player-score]')).toHaveText(String(question.value));
      for (const phone of phones.slice(1)) await expect(phone.locator('[data-player-score]')).toHaveText('0');
      await expect(display.locator('.showcase-player-card').filter({ hasText: names[0] }).locator('[data-player-score]')).toHaveText(String(question.value));
    } finally {
      await displayContext.close();
      await Promise.all(contexts.map((context) => context.close()));
      await hostContext.close();
    }
  });
}
