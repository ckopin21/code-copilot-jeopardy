import { expect, test } from '@playwright/test';

const viewports = [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 }
];

async function assertViewportFit(page, rootSelector = 'body') {
  const issues = await page.locator(rootSelector).evaluate((root) => {
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const bad = [];
    const candidates = [root, ...root.querySelectorAll('*')];
    for (const el of candidates) {
      if (!(el instanceof HTMLElement)) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
      if (el.matches('.dev-mode-panel,.dev-presentation-controls,.audio-drawer,.modal-backdrop')) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      if (rect.left < -2 || rect.right > vw + 2 || rect.top < -2 || rect.bottom > vh + 2) {
        bad.push({ selector: el.className || el.tagName, rect: [rect.left, rect.top, rect.right, rect.bottom] });
        if (bad.length >= 8) break;
      }
    }
    return bad;
  });
  expect(issues).toEqual([]);
}

for (const mode of ['Classic', 'Free Response']) {
  for (const viewport of viewports) {
    test(`${mode} host and presentation fit at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/?mode=host&fresh=1');
      await page.getByRole('button', { name: new RegExp(mode) }).click();
      await page.getByRole('button', { name: 'Start Game' }).click();
      await expect(page.locator('.showcase-board-stage .board')).toBeVisible();
      await assertViewportFit(page, '.showcase-host');

      await page.getByRole('button', { name: 'Presentation', exact: true }).click();
      await expect(page.locator('.board-presentation-mode')).toBeVisible();
      await assertViewportFit(page, '.board-presentation-mode');
    });
  }
}

test('presentation lab dynamic overlays remain on-screen', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/?mode=host&fresh=1');
  await page.getByRole('button', { name: 'Open presentation visual lab' }).click();
  await expect(page.locator('.dev-presentation-lab')).toBeVisible();

  await page.locator('.dev-presentation-control-row select').first().selectOption('5');
  await page.getByText('Stress-test long question text').click();
  await assertViewportFit(page, '.dev-presentation-surface');

  for (const label of ['2× reveal', '3× reveal', 'Final reveal', 'Round start', 'Daily Double', 'Final Round', 'Results']) {
    await page.getByRole('button', { name: label }).click();
    await page.waitForTimeout(100);
    const overlay = page.locator('.modifier-reveal-overlay,.final-reveal-spectacle,.game-transition-overlay').last();
    if (await overlay.count()) await assertViewportFit(page, '.dev-presentation-lab');
    await page.getByRole('button', { name: 'Clear' }).click();
  }
});
