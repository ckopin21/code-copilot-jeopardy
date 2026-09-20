import { expect, test, type Locator, type Page } from '@playwright/test';

type CardGeometry = {
  width: number;
  height: number;
  statusPosition: string | null;
  statusBadgeCount: number;
  visibleStatusBadgeCount: number;
  mainStatusOverlap: boolean;
  avatarStatusOverlap: boolean;
  mainTurnOverlap: boolean;
  badgesContained: boolean;
  turnContained: boolean;
  avatarCenterDelta: number;
  avatarArtCenterDelta: number;
  avatarGlyphTransform: string;
  statusBackgroundColor: string | null;
  statusBoxShadow: string | null;
  statusFilter: string | null;
  statusBackdropFilter: string | null;
  statusOverflow: string | null;
  statusBeforeContent: string | null;
  statusAfterContent: string | null;
  visiblePillBackgrounds: string[];
  visiblePillShadows: string[];
  nameWhiteSpace: string;
  nameOverflow: string;
  nameTextOverflow: string;
};

const closeTo = (actual: number, expected: number, tolerance = 1.5) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
};

const isTransparent = (value: string | null) =>
  value === null || value === 'transparent' || value === 'rgba(0, 0, 0, 0)';

function expectAvatarCentered(geometry: CardGeometry) {
  expect(geometry.avatarCenterDelta).toBeLessThanOrEqual(1);
  expect(geometry.avatarArtCenterDelta).toBeLessThanOrEqual(1);
  expect(geometry.avatarGlyphTransform).not.toBe('none');
}

function expectTransparentStatusLane(geometry: CardGeometry, expectedVisiblePills: number) {
  expect(geometry.statusPosition).toBe('absolute');
  expect(geometry.statusOverflow).toBe('visible');
  expect(isTransparent(geometry.statusBackgroundColor)).toBe(true);
  expect(geometry.statusBoxShadow).toBe('none');
  expect(geometry.statusFilter).toBe('none');
  expect(['', 'none']).toContain(geometry.statusBackdropFilter ?? '');
  expect(['none', 'normal', '""']).toContain(geometry.statusBeforeContent ?? 'none');
  expect(['none', 'normal', '""']).toContain(geometry.statusAfterContent ?? 'none');
  expect(geometry.visibleStatusBadgeCount).toBe(expectedVisiblePills);
  expect(geometry.visiblePillBackgrounds.every((value) => !isTransparent(value))).toBe(true);
  expect(geometry.visiblePillShadows.every((value) => value !== 'none')).toBe(true);
}

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
    const centerY = (rect: ReturnType<typeof rectOf>) => (rect.top + rect.bottom) / 2;

    const cardRect = rectOf(element);
    const main = element.querySelector('.player-card-main');
    const avatar = element.querySelector('.player-avatar-large');
    const avatarArt = element.querySelector('.player-avatar-large .player-avatar-art');
    const avatarGlyph = element.querySelector('.player-avatar-large .player-avatar-emoji');
    const status = element.querySelector('.player-status-stack');
    const directTurn = element.querySelector(':scope > .turn-beacon');
    const name = element.querySelector('.player-name strong');
    if (
      !(main instanceof HTMLElement) ||
      !(avatar instanceof HTMLElement) ||
      !(avatarArt instanceof HTMLElement) ||
      !(avatarGlyph instanceof HTMLElement) ||
      !(name instanceof HTMLElement)
    ) {
      throw new Error('Missing player card content');
    }

    const mainRect = rectOf(main);
    const avatarRect = rectOf(avatar);
    const avatarArtRect = rectOf(avatarArt);
    const statusRect = status instanceof HTMLElement ? rectOf(status) : null;
    const turnRect = directTurn instanceof HTMLElement ? rectOf(directTurn) : null;
    const badges = status instanceof HTMLElement
      ? Array.from(status.querySelectorAll('.streak-ribbon, .turn-beacon')).filter((node): node is HTMLElement => node instanceof HTMLElement)
      : [];
    const visibleBadges = badges.filter((badge) => {
      const style = getComputedStyle(badge);
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') > 0;
    });
    const nameStyle = getComputedStyle(name);
    const statusStyle = status instanceof HTMLElement ? getComputedStyle(status) : null;

    return {
      width: element.offsetWidth,
      height: element.offsetHeight,
      statusPosition: statusStyle?.position ?? null,
      statusBadgeCount: badges.length,
      visibleStatusBadgeCount: visibleBadges.length,
      mainStatusOverlap: statusRect ? overlaps(mainRect, statusRect) : false,
      avatarStatusOverlap: statusRect ? overlaps(avatarRect, statusRect) : false,
      mainTurnOverlap: turnRect && turnRect.width > 0 && turnRect.height > 0 ? overlaps(mainRect, turnRect) : false,
      badgesContained: visibleBadges.every((badge) => contains(cardRect, rectOf(badge))),
      turnContained: turnRect && turnRect.width > 0 && turnRect.height > 0 ? contains(cardRect, turnRect) : true,
      avatarCenterDelta: Math.abs(centerY(avatarRect) - centerY(cardRect)),
      avatarArtCenterDelta: Math.abs(centerY(avatarArtRect) - centerY(avatarRect)),
      avatarGlyphTransform: getComputedStyle(avatarGlyph).transform,
      statusBackgroundColor: statusStyle?.backgroundColor ?? null,
      statusBoxShadow: statusStyle?.boxShadow ?? null,
      statusFilter: statusStyle?.filter ?? null,
      statusBackdropFilter: statusStyle?.getPropertyValue('backdrop-filter') ?? null,
      statusOverflow: statusStyle?.overflow ?? null,
      statusBeforeContent: status instanceof HTMLElement ? getComputedStyle(status, '::before').content : null,
      statusAfterContent: status instanceof HTMLElement ? getComputedStyle(status, '::after').content : null,
      visiblePillBackgrounds: visibleBadges.map((badge) => getComputedStyle(badge).backgroundColor),
      visiblePillShadows: visibleBadges.map((badge) => getComputedStyle(badge).boxShadow),
      nameWhiteSpace: nameStyle.whiteSpace,
      nameOverflow: nameStyle.overflow,
      nameTextOverflow: nameStyle.textOverflow
    };
  });
}

async function openDevPanel(page: Page, viewport = { width: 1440, height: 900 }) {
  await page.setViewportSize(viewport);
  await page.goto('/?mode=host&fresh=1');
  await page.getByRole('button', { name: 'Open developer mode' }).click();
  const panel = page.locator('.dev-mode-panel');
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: '2P', exact: true }).click();

  // Exercise the exact normal-host cascade around the production PlayerStrip without
  // changing the game room. Previous coverage only tested the isolated dev-stage cascade.
  await panel.locator('.dev-stage').evaluate((element) => element.classList.add('showcase-host'));
  return panel;
}

async function setPlayerCount(panel: Locator, count: 2 | 3 | 4 | 5) {
  await panel.getByRole('button', { name: `${count}P`, exact: true }).click();
}

async function setCardState(panel: Locator, state: 'ready' | 'active' | 'fire' | 'cold') {
  await panel.locator('label').filter({ hasText: 'Selected card state' }).locator('select').selectOption(state);
}

async function setTurnPreview(panel: Locator, state: 'none' | 'board' | 'question') {
  await panel.locator('label').filter({ hasText: 'Turn preview' }).locator('select').selectOption(state);
}

async function setBoardMultiplier(panel: Locator, multiplier: 1 | 2 | 3) {
  await panel.locator('label').filter({ hasText: 'Board modifier' }).locator('select').selectOption(String(multiplier));
}

test('Question View keeps player-card geometry stable and the status lane visually transparent', async ({ page }) => {
  const panel = await openDevPanel(page, { width: 1440, height: 900 });
  const selected = panel.locator('.dev-stage [data-player-id="dev-player-2"]');
  const normal = panel.locator('.dev-stage [data-player-id="dev-player-1"]');
  await expect(selected).toBeVisible();
  await expect(normal).toBeVisible();

  await setTurnPreview(panel, 'none');
  await setCardState(panel, 'ready');
  const normalGeometry = await measurePlayerCard(normal);
  const baseline = await measurePlayerCard(selected);
  closeTo(baseline.width, normalGeometry.width);
  closeTo(baseline.height, normalGeometry.height);
  expectAvatarCentered(baseline);

  await setTurnPreview(panel, 'question');
  const turnGeometry = await measurePlayerCard(selected);
  closeTo(turnGeometry.width, baseline.width);
  closeTo(turnGeometry.height, baseline.height);
  expect(turnGeometry.mainTurnOverlap).toBe(false);
  expect(turnGeometry.turnContained).toBe(true);
  expectAvatarCentered(turnGeometry);

  await setTurnPreview(panel, 'none');
  await setCardState(panel, 'fire');
  const fireOnly = await measurePlayerCard(selected);
  closeTo(fireOnly.width, baseline.width);
  closeTo(fireOnly.height, baseline.height);
  expect(fireOnly.statusBadgeCount).toBe(1);
  expect(fireOnly.mainStatusOverlap).toBe(false);
  expect(fireOnly.avatarStatusOverlap).toBe(false);
  expect(fireOnly.badgesContained).toBe(true);
  expectTransparentStatusLane(fireOnly, 1);
  expectAvatarCentered(fireOnly);

  await setCardState(panel, 'cold');
  const coldOnly = await measurePlayerCard(selected);
  closeTo(coldOnly.width, baseline.width);
  closeTo(coldOnly.height, baseline.height);
  expect(coldOnly.statusBadgeCount).toBe(1);
  expect(coldOnly.mainStatusOverlap).toBe(false);
  expect(coldOnly.avatarStatusOverlap).toBe(false);
  expectTransparentStatusLane(coldOnly, 1);

  await setTurnPreview(panel, 'question');
  await setCardState(panel, 'fire');
  const fireTurn = await measurePlayerCard(selected);
  closeTo(fireTurn.width, baseline.width);
  closeTo(fireTurn.height, baseline.height);
  expect(fireTurn.statusBadgeCount).toBe(2);
  expect(fireTurn.mainStatusOverlap).toBe(false);
  expect(fireTurn.avatarStatusOverlap).toBe(false);
  expect(fireTurn.badgesContained).toBe(true);
  expectTransparentStatusLane(fireTurn, 2);

  await setCardState(panel, 'cold');
  const coldTurn = await measurePlayerCard(selected);
  closeTo(coldTurn.width, baseline.width);
  closeTo(coldTurn.height, baseline.height);
  expect(coldTurn.statusBadgeCount).toBe(2);
  expect(coldTurn.mainStatusOverlap).toBe(false);
  expect(coldTurn.avatarStatusOverlap).toBe(false);
  expectTransparentStatusLane(coldTurn, 2);

  await setCardState(panel, 'fire');
  await setBoardMultiplier(panel, 2);
  const doubleGeometry = await measurePlayerCard(selected);
  closeTo(doubleGeometry.width, baseline.width);
  closeTo(doubleGeometry.height, baseline.height);
  expect(doubleGeometry.mainStatusOverlap).toBe(false);
  expectTransparentStatusLane(doubleGeometry, 2);

  await setBoardMultiplier(panel, 3);
  const tripleGeometry = await measurePlayerCard(selected);
  closeTo(tripleGeometry.width, baseline.width);
  closeTo(tripleGeometry.height, baseline.height);
  expect(tripleGeometry.mainStatusOverlap).toBe(false);
  expectTransparentStatusLane(tripleGeometry, 2);

  await setTurnPreview(panel, 'question');
  await setCardState(panel, 'ready');
  const name = selected.locator('.player-name strong');
  await name.evaluate((element) => {
    element.textContent = 'Alexandria Maximilian The Third With An Extremely Long Player Name';
  });
  const longNameGeometry = await measurePlayerCard(selected);
  closeTo(longNameGeometry.width, baseline.width);
  closeTo(longNameGeometry.height, baseline.height);
  expect(longNameGeometry.nameWhiteSpace).toBe('nowrap');
  expect(longNameGeometry.nameOverflow).toBe('hidden');
  expect(longNameGeometry.nameTextOverflow).toBe('ellipsis');
  expect(await name.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  expect(longNameGeometry.mainTurnOverlap).toBe(false);
});

test('Board View star-only turn state keeps the same player-card geometry', async ({ page }) => {
  const panel = await openDevPanel(page);
  const selected = panel.locator('.dev-stage [data-player-id="dev-player-2"]');

  await setTurnPreview(panel, 'none');
  await setCardState(panel, 'ready');
  const baseline = await measurePlayerCard(selected);

  await setTurnPreview(panel, 'board');
  const boardTurn = await measurePlayerCard(selected);
  closeTo(boardTurn.width, baseline.width);
  closeTo(boardTurn.height, baseline.height);
  expect(boardTurn.mainTurnOverlap).toBe(false);
  expectAvatarCentered(boardTurn);

  await setCardState(panel, 'fire');
  const boardFire = await measurePlayerCard(selected);
  closeTo(boardFire.width, baseline.width);
  closeTo(boardFire.height, baseline.height);
  expect(boardFire.mainStatusOverlap).toBe(false);
  expect(boardFire.avatarStatusOverlap).toBe(false);
  expectTransparentStatusLane(boardFire, 1);
});

test('avatar remains centered for 2–5 players in the normal-host cascade', async ({ page }) => {
  const panel = await openDevPanel(page);
  await setTurnPreview(panel, 'question');
  await setCardState(panel, 'fire');

  for (const count of [2, 3, 4, 5] as const) {
    await setPlayerCount(panel, count);
    const selected = panel.locator('.dev-stage [data-player-id="dev-player-2"]');
    const geometry = await measurePlayerCard(selected);
    expectAvatarCentered(geometry);
    expect(geometry.mainStatusOverlap).toBe(false);
    expect(geometry.avatarStatusOverlap).toBe(false);
    expectTransparentStatusLane(geometry, 2);
  }
});

for (const viewport of [
  { width: 742, height: 700, label: '742px Question View' },
  { width: 390, height: 844, label: 'mobile' }
]) {
  test(`${viewport.label} keeps status effects from resizing or painting the wrapper`, async ({ page }) => {
    const panel = await openDevPanel(page, { width: viewport.width, height: viewport.height });
    const selected = panel.locator('.dev-stage [data-player-id="dev-player-2"]');

    await setTurnPreview(panel, 'none');
    await setCardState(panel, 'ready');
    const baseline = await measurePlayerCard(selected);

    await setCardState(panel, 'fire');
    const fireOnly = await measurePlayerCard(selected);
    closeTo(fireOnly.width, baseline.width);
    closeTo(fireOnly.height, baseline.height);
    expectAvatarCentered(fireOnly);
    expect(fireOnly.mainStatusOverlap).toBe(false);
    expect(fireOnly.avatarStatusOverlap).toBe(false);
    expectTransparentStatusLane(fireOnly, 1);

    await setTurnPreview(panel, 'question');
    const fireTurn = await measurePlayerCard(selected);
    closeTo(fireTurn.width, baseline.width);
    closeTo(fireTurn.height, baseline.height);
    expect(fireTurn.mainStatusOverlap).toBe(false);
    expect(fireTurn.avatarStatusOverlap).toBe(false);
    expectTransparentStatusLane(fireTurn, 2);
  });
}

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
