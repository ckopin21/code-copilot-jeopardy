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
        bad.push({ selector: String(el.className || el.tagName), rect: [rect.left, rect.top, rect.right, rect.bottom] });
        if (bad.length >= 8) break;
      }
    }
    return bad;
  });
  expect(issues).toEqual([]);
}

async function openBoardHarness(page, gameMode) {
  await page.goto('/?mode=host&fresh=1');
  await page.getByRole('button', { name: 'Open presentation visual lab' }).click();
  await expect(page.locator('.dev-presentation-lab')).toBeVisible();
  await page.getByLabel('Preview game mode').selectOption(gameMode);
  await page.locator('.dev-presentation-control-row select').first().selectOption('5');
}

for (const viewport of viewports) {
  test(`desktop menu controls are centered and constrained at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.locator('.showcase-menu .menu-mode-grid')).toBeVisible();

    const geometry = await page.evaluate(() => {
      const rect = (selector) => {
        const element = document.querySelector(selector);
        if (!(element instanceof HTMLElement)) throw new Error(`Missing ${selector}`);
        const value = element.getBoundingClientRect();
        return { left: value.left, width: value.width, height: value.height };
      };
      return {
        hostSection: rect('.host-menu-section'),
        hostActions: rect('.host-menu-actions'),
        joinSection: rect('.player-menu-section'),
        joinButton: rect('.join-game-button')
      };
    });

    const centerOffset = (outer, inner) =>
      Math.abs((inner.left + inner.width / 2) - (outer.left + outer.width / 2));

    expect(centerOffset(geometry.hostSection, geometry.hostActions)).toBeLessThanOrEqual(2);
    expect(centerOffset(geometry.joinSection, geometry.joinButton)).toBeLessThanOrEqual(2);
    expect(geometry.hostActions.width).toBeLessThan(geometry.hostSection.width * 0.92);
    expect(geometry.joinButton.width).toBeLessThan(geometry.joinSection.width * 0.94);
    expect(geometry.joinButton.height).toBeGreaterThanOrEqual(88);
    expect(geometry.joinButton.height).toBeLessThanOrEqual(132);
  });
}

for (const gameMode of ['classic', 'free-response']) {
  for (const viewport of viewports) {
    test(`${gameMode} deterministic host and presentation boards fit at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await openBoardHarness(page, gameMode);

      await page.getByLabel('Preview board multiplier').selectOption(viewport.width === 1366 ? '3' : '2');
      await page.getByLabel('Preview surface').selectOption('host-board');
      await expect(page.locator('.dev-host-board-surface .showcase-board-stage .board')).toBeVisible();
      await expect(page.locator('.dev-host-board-surface .used-result-chip')).toHaveCount(4);
      await assertViewportFit(page, '.dev-host-board-surface');

      await page.getByLabel('Preview surface').selectOption('presentation-board');
      await expect(page.locator('.dev-board-presentation .board-presentation-mode')).toBeVisible();
      await expect(page.locator('.dev-board-presentation .presentation-name-card')).toHaveCount(5);
      await assertViewportFit(page, '.dev-board-presentation');
    });
  }
}

test('deterministic board harness supports multiple player counts and long names', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openBoardHarness(page, 'free-response');

  const playerSelect = page.locator('.dev-presentation-control-row select').first();
  for (const count of ['2', '3', '4', '5']) {
    await playerSelect.selectOption(count);
    await page.getByLabel('Preview surface').selectOption('presentation-board');
    await expect(page.locator('.dev-board-presentation .presentation-name-card')).toHaveCount(Number(count));
    await assertViewportFit(page, '.dev-board-presentation');
  }
});

test('presentation lab dynamic overlays remain on-screen', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/?mode=host&fresh=1');
  await page.getByRole('button', { name: 'Open presentation visual lab' }).click();
  await expect(page.locator('.dev-presentation-lab')).toBeVisible();

  await page.locator('.dev-presentation-control-row select').first().selectOption('5');
  await page.getByText('Stress-test long question text').click();
  await assertViewportFit(page, '.dev-presentation-surface');

  for (const label of ['Score +', 'Score −', '2× reveal', '3× reveal', 'Final reveal', 'Round start', 'Daily Double', 'Final Round', 'Results']) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await page.waitForTimeout(100);
    const overlay = page.locator('.score-flight,.modifier-reveal-overlay,.final-reveal-spectacle,.game-transition-overlay').last();
    if (await overlay.count()) await assertViewportFit(page, '.dev-presentation-lab');
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
  }
});
