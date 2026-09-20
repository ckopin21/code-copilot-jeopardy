import { expect, test, type Locator, type Page } from '@playwright/test';

type CardGeometry = {
  width: number;
  height: number;
  statusPosition: string | null;
  statusBadgeCount: number;
  mainStatusOverlap: boolean;
  avatarStatusOverlap: boolean;
  mainTurnOverlap: boolean;
  badgesContained: boolean;
  turnContained: boolean;
  nameWhiteSpace: string;
  nameOverflow: string;
  nameTextOverflow: string;
};

const closeTo = (actual: number, expected: number, tolerance = 1.5) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
};

async function measurePlayerCard(card: Locator): Promise<CardGeometry> {
  return card.evaluate((element) => {
    if (!(element instanceof HTMLElement)) throw new Error('Expected player card');
    const rectOf = (node: Element) => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
    };
    const overlaps = (a: ReturnType<typeof rectOf>, b: ReturnType<typeof rectOf>) =>
      Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
      Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
    const contains = (outer: ReturnType<typeof rectOf>, inner: ReturnType<typeof rectOf>) =>
      inner.left >= outer.left - 1 &&
      inner.right <= outer.right + 1 &&
      inner.top >= outer.top - 1 &&
      inner.bottom <= outer.bottom + 1;

    const cardRect = rectOf(element);
    const main = element.querySelector('.player-card-main');
    const avatar = element.querySelector('.player-avatar-large');
    const status = element.querySelector('.player-status-stack');
    const directTurn = element.querySelector(':scope > .turn-beacon');
    const name = element.querySelector('.player-name strong');
    if (!(main instanceof HTMLElement) || !(avatar instanceof HTMLElement) || !(name instanceof HTMLElement)) {
      throw new Error('Missing player card content');
    }

    const mainRect = rectOf(main);
    const avatarRect = rectOf(avatar);
    const statusRect = status instanceof HTMLElement ? rectOf(status) : null;
    const turnRect = directTurn instanceof HTMLElement ? rectOf(directTurn) : null;
    const badges = status instanceof HTMLElement
      ? Array.from(status.querySelectorAll('.streak-ribbon, .turn-beacon')).filter((node): node is HTMLElement => node instanceof HTMLElement)
      : [];
    const nameStyle = getComputedStyle(name);

    return {
      width: element.offsetWidth,
      height: element.offsetHeight,
      statusPosition: status instanceof HTMLElement ? getComputedStyle(status).position : null,
      statusBadgeCount: badges.length,
      mainStatusOverlap: statusRect ? overlaps(mainRect, statusRect) : false,
      avatarStatusOverlap: statusRect ? overlaps(avatarRect, statusRect) : false,
      mainTurnOverlap: turnRect ? overlaps(mainRect, turnRect) : false,
      badgesContained: badges.every((badge) => contains(cardRect, rectOf(badge))),
      turnContained: turnRect ? contains(cardRect, turnRect) : true,
      nameWhiteSpace: nameStyle.whiteSpace,
      nameOverflow: nameStyle.overflow,
      nameTextOverflow: nameStyle.textOverflow
    };
  });
}

async function openDevPanel(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?mode=host&fresh=1');
  await page.getByRole('button', { name: 'Open developer mode' }).click();
  const panel = page.locator('.dev-mode-panel');
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: '2P', exact: true }).click();
  return panel;
}

async function setCardState(panel: Locator, state: 'ready' | 'active' | 'fire' | 'cold') {
  await panel.locator('label').filter({ hasText: 'Selected card state' }).locator('select').selectOption(state);
}

async function setBoardMultiplier(panel: Locator, multiplier: 1 | 2 | 3) {
  await panel.locator('label').filter({ hasText: 'Board modifier' }).locator('select').selectOption(String(multiplier));
}

test('player cards keep identical geometry across turn, Fire, Cold, 2x, 3x, and long names', async ({ page }) => {
  const panel = await openDevPanel(page);
  const selected = panel.locator('.dev-stage [data-player-id="dev-player-2"]');
  const normal = panel.locator('.dev-stage [data-player-id="dev-player-1"]');
  await expect(selected).toBeVisible();
  await expect(normal).toBeVisible();

  await setCardState(panel, 'ready');
  const normalGeometry = await measurePlayerCard(normal);
  const turnGeometry = await measurePlayerCard(selected);
  closeTo(turnGeometry.width, normalGeometry.width);
  closeTo(turnGeometry.height, normalGeometry.height);
  expect(turnGeometry.mainTurnOverlap).toBe(false);
  expect(turnGeometry.turnContained).toBe(true);

  await setCardState(panel, 'fire');
  await expect(selected).toHaveClass(/is-fire/);
  const fireGeometry = await measurePlayerCard(selected);
  closeTo(fireGeometry.width, turnGeometry.width);
  closeTo(fireGeometry.height, turnGeometry.height);
  expect(fireGeometry.statusPosition).toBe('absolute');
  expect(fireGeometry.statusBadgeCount).toBe(2);
  expect(fireGeometry.mainStatusOverlap).toBe(false);
  expect(fireGeometry.avatarStatusOverlap).toBe(false);
  expect(fireGeometry.badgesContained).toBe(true);

  await setCardState(panel, 'cold');
  await expect(selected).toHaveClass(/is-cold/);
  const coldGeometry = await measurePlayerCard(selected);
  closeTo(coldGeometry.width, turnGeometry.width);
  closeTo(coldGeometry.height, turnGeometry.height);
  expect(coldGeometry.statusPosition).toBe('absolute');
  expect(coldGeometry.statusBadgeCount).toBe(2);
  expect(coldGeometry.mainStatusOverlap).toBe(false);
  expect(coldGeometry.avatarStatusOverlap).toBe(false);
  expect(coldGeometry.badgesContained).toBe(true);

  await setCardState(panel, 'fire');
  await setBoardMultiplier(panel, 2);
  const doubleGeometry = await measurePlayerCard(selected);
  closeTo(doubleGeometry.width, turnGeometry.width);
  closeTo(doubleGeometry.height, turnGeometry.height);
  expect(doubleGeometry.mainStatusOverlap).toBe(false);

  await setBoardMultiplier(panel, 3);
  const tripleGeometry = await measurePlayerCard(selected);
  closeTo(tripleGeometry.width, turnGeometry.width);
  closeTo(tripleGeometry.height, turnGeometry.height);
  expect(tripleGeometry.mainStatusOverlap).toBe(false);

  await setCardState(panel, 'ready');
  const name = selected.locator('.player-name strong');
  await name.evaluate((element) => {
    element.textContent = 'Alexandria Maximilian The Third With An Extremely Long Player Name';
  });
  const longNameGeometry = await measurePlayerCard(selected);
  closeTo(longNameGeometry.width, turnGeometry.width);
  closeTo(longNameGeometry.height, turnGeometry.height);
  expect(longNameGeometry.nameWhiteSpace).toBe('nowrap');
  expect(longNameGeometry.nameOverflow).toBe('hidden');
  expect(longNameGeometry.nameTextOverflow).toBe('ellipsis');
  expect(await name.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  expect(longNameGeometry.mainTurnOverlap).toBe(false);
});

async function openProductionPresentation(page: Page, multiplier: 2 | 3) {
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, 'requestFullscreen', {
      configurable: true,
      value: async function (this: Element) {
        this.setAttribute('data-playwright-fullscreen-target', 'true');
        throw new Error('Use deterministic fallback fullscreen in layout tests');
      }
    });
  });

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/?mode=host&fresh=1');
  await page.getByRole('button', { name: 'Open developer mode' }).click();
  const panel = page.locator('.dev-mode-panel');
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: '5P', exact: true }).click();
  await setBoardMultiplier(panel, multiplier);

  const lab = page.locator('.dev-visual-lab-section');
  await lab.getByRole('button', { name: 'Fullscreen Visual & animation lab' }).click();
  await expect(lab).toHaveAttribute('data-dev-visual-lab-fullscreen', 'true');
  await lab.getByRole('button', { name: 'Presentation Mode', exact: true }).click();

  const presentation = lab.locator('[data-dev-production-presentation="true"] .board-presentation-mode');
  await expect(presentation).toBeVisible();
  return presentation;
}

async function measurePresentationCard(card: Locator) {
  return card.evaluate((element) => {
    if (!(element instanceof HTMLElement)) throw new Error('Expected presentation card');
    const rectOf = (node: Element) => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
    };
    const overlaps = (a: ReturnType<typeof rectOf>, b: ReturnType<typeof rectOf>) =>
      Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
      Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
    const contains = (outer: ReturnType<typeof rectOf>, inner: ReturnType<typeof rectOf>) =>
      inner.left >= outer.left - 1 &&
      inner.right <= outer.right + 1 &&
      inner.top >= outer.top - 1 &&
      inner.bottom <= outer.bottom + 1;

    const avatar = element.querySelector('.presentation-player-avatar');
    const main = element.querySelector('.presentation-player-main');
    const name = main?.querySelector('strong');
    const status = main?.querySelector('small');
    const score = element.querySelector(':scope > b');
    if (!(avatar instanceof HTMLElement) || !(main instanceof HTMLElement) || !(name instanceof HTMLElement) || !(status instanceof HTMLElement) || !(score instanceof HTMLElement)) {
      throw new Error('Missing presentation card content');
    }

    const cardRect = rectOf(element);
    const avatarRect = rectOf(avatar);
    const mainRect = rectOf(main);
    const scoreRect = rectOf(score);
    const nameStyle = getComputedStyle(name);
    const statusStyle = getComputedStyle(status);

    return {
      width: element.offsetWidth,
      height: element.offsetHeight,
      avatarMainOverlap: overlaps(avatarRect, mainRect),
      mainScoreOverlap: overlaps(mainRect, scoreRect),
      childrenContained: [avatar, main, name, status, score].every((node) => contains(cardRect, rectOf(node))),
      nameWhiteSpace: nameStyle.whiteSpace,
      nameOverflow: nameStyle.overflow,
      nameTextOverflow: nameStyle.textOverflow,
      statusWhiteSpace: statusStyle.whiteSpace,
      statusOverflow: statusStyle.overflow,
      statusTextOverflow: statusStyle.textOverflow
    };
  });
}

for (const multiplier of [2, 3] as const) {
  test(`Presentation Mode keeps fixed player cards with ${multiplier}x modifier and Fire/Cold states`, async ({ page }) => {
    const presentation = await openProductionPresentation(page, multiplier);
    const cards = presentation.locator('.presentation-name-card:not(.practice)');
    await expect(cards).toHaveCount(5);

    const heights = await cards.evaluateAll((nodes) => nodes.map((node) => node instanceof HTMLElement ? node.offsetHeight : node.getBoundingClientRect().height));
    for (const height of heights) closeTo(height, heights[0]);

    const fire = presentation.locator('.presentation-name-card.is-fire').first();
    const coldTurn = presentation.locator('.presentation-name-card.is-cold.is-turn').first();
    await expect(fire).toBeVisible();
    await expect(coldTurn).toBeVisible();

    for (const card of [fire, coldTurn]) {
      const geometry = await measurePresentationCard(card);
      closeTo(geometry.height, heights[0]);
      expect(geometry.avatarMainOverlap).toBe(false);
      expect(geometry.mainScoreOverlap).toBe(false);
      expect(geometry.childrenContained).toBe(true);
      expect(geometry.nameWhiteSpace).toBe('nowrap');
      expect(geometry.nameOverflow).toBe('hidden');
      expect(geometry.nameTextOverflow).toBe('ellipsis');
      expect(geometry.statusWhiteSpace).toBe('nowrap');
      expect(geometry.statusOverflow).toBe('hidden');
      expect(geometry.statusTextOverflow).toBe('ellipsis');
    }

    const expectedModifier = multiplier === 2 ? '2× DOUBLE POINTS' : '3× TRIPLE POINTS';
    await expect(presentation.locator('.presentation-modifier')).toHaveText(expectedModifier);

    const fireName = fire.locator('.presentation-player-main strong');
    await fireName.evaluate((element) => {
      element.textContent = 'Alexandria Maximilian The Third With An Extremely Long Presentation Name';
    });
    const longNameGeometry = await measurePresentationCard(fire);
    closeTo(longNameGeometry.height, heights[0]);
    expect(longNameGeometry.mainScoreOverlap).toBe(false);
    expect(longNameGeometry.childrenContained).toBe(true);
    expect(await fireName.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  });
}
