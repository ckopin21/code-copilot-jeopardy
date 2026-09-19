import { expect, test } from '@playwright/test';

const viewports = [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 }
];

const menuViewports = [
  ...viewports,
  { width: 2048, height: 665 }
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

for (const viewport of menuViewports) {
  test(`desktop menu panels stay compact and centered at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.locator('.showcase-menu .menu-mode-grid')).toBeVisible();

    const geometry = await page.evaluate(() => {
      const rect = (selector) => {
        const element = document.querySelector(selector);
        if (!(element instanceof HTMLElement)) throw new Error(`Missing ${selector}`);
        const value = element.getBoundingClientRect();
        return {
          left: value.left,
          top: value.top,
          right: value.right,
          bottom: value.bottom,
          width: value.width,
          height: value.height
        };
      };
      return {
        grid: rect('.menu-mode-grid'),
        hostSection: rect('.host-menu-section'),
        hostActions: rect('.host-menu-actions'),
        joinSection: rect('.player-menu-section'),
        joinHeader: rect('.player-menu-section > header'),
        joinButton: rect('.join-game-button')
      };
    });

    const centerOffset = (outer, inner) =>
      Math.abs((inner.left + inner.width / 2) - (outer.left + outer.width / 2));

    expect(geometry.grid.width).toBeLessThanOrEqual(1282);
    expect(geometry.hostSection.width).toBeLessThanOrEqual(900);
    expect(geometry.joinSection.width).toBeLessThanOrEqual(450);
    expect(geometry.hostSection.height).toBeLessThanOrEqual(320);

    expect(centerOffset(geometry.hostSection, geometry.hostActions)).toBeLessThanOrEqual(2);
    expect(centerOffset(geometry.joinSection, geometry.joinButton)).toBeLessThanOrEqual(2);
    expect(geometry.hostActions.width).toBeLessThanOrEqual(762);
    expect(geometry.joinButton.width).toBeLessThanOrEqual(342);
    expect(geometry.joinButton.height).toBeGreaterThanOrEqual(70);
    expect(geometry.joinButton.height).toBeLessThanOrEqual(104);

    expect(geometry.joinButton.top - geometry.joinHeader.bottom).toBeGreaterThanOrEqual(4);
    expect(geometry.joinSection.bottom - geometry.joinButton.bottom).toBeGreaterThanOrEqual(4);
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


const phoneViewports = [
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 430, height: 932 }
];

for (const viewport of phoneViewports) {
  test(`player customization stays usable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/?mode=player&room=ABCDE');
    const card = page.locator('.join-form-v2');
    await expect(card).toBeVisible();
    await expect(page.locator('[data-testid="player-customization-preview"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Join Game' })).toBeVisible();

    const bounds = await card.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + 1);

    await page.getByRole('tab', { name: 'Style' }).click();
    await page.getByRole('button', { name: 'Mint' }).click();
    const accentSwatch = page.getByRole('button', { name: 'Mint' });
    const accentBounds = await accentSwatch.boundingBox();
    expect(accentBounds).not.toBeNull();
    expect(Math.abs(accentBounds!.width - accentBounds!.height)).toBeLessThanOrEqual(1);
    await page.getByRole('button', { name: 'Halo' }).click();
    await page.locator('.customization-select select').selectOption('professor');
    await expect(page.locator('[data-testid="player-customization-preview"] [data-frame="halo"]')).toBeVisible();
    await expect(page.locator('[data-testid="player-customization-preview"]')).toHaveCSS('--accent', '#5eead4');

    await page.getByRole('tab', { name: 'Effects' }).click();

    await page.getByRole('button', { name: 'Classic' }).click();
    await expect(page.locator('[data-testid="player-customization-preview"]')).toHaveAttribute('data-preview-kind', 'buzzer');
    await expect(page.locator('.effect-preview-buzz')).toBeVisible();

    await page.getByRole('button', { name: 'Wave' }).click();
    await expect(page.locator('[data-testid="player-customization-preview"]')).toHaveAttribute('data-score-effect', 'wave');
    await expect(page.locator('[data-testid="player-customization-preview"]')).toHaveAttribute('data-preview-kind', 'score');
    await expect(page.locator('.effect-preview-score')).toBeVisible();

    await page.getByRole('button', { name: 'Stars' }).click();
    await expect(page.locator('[data-testid="player-customization-preview"]')).toHaveAttribute('data-victory-effect', 'stars');
    await expect(page.locator('[data-testid="player-customization-preview"]')).toHaveAttribute('data-preview-kind', 'victory');
    await expect(page.locator('.effect-preview-stars')).toBeVisible();

    await page.getByRole('tab', { name: 'Avatar' }).click();
    await page.getByRole('button', { name: 'Robots' }).click();
    await page.getByRole('button', { name: 'Robot', exact: true }).click();
    const selectedAvatar = page.locator('[data-testid="player-customization-preview"] [data-avatar-id="bot-atlas"]');
    await expect(selectedAvatar).toBeVisible();
    await expect(selectedAvatar.locator('.player-avatar-emoji')).toHaveText('🤖');

    const touchTargets = await page.locator('.customization-tabs button, .avatar-grid-v3 > button').evaluateAll((buttons) =>
      buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        return Math.min(rect.width, rect.height);
      })
    );
    expect(Math.min(...touchTargets)).toBeGreaterThanOrEqual(40);
  });
}
