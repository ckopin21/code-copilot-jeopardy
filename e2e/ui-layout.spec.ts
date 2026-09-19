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

async function assertUsedResultTilesContained(page, rootSelector) {
  const issues = await page.locator(rootSelector).evaluate((root) => {
    const tolerance = 1.5;
    const contains = (outer, inner) =>
      inner.left >= outer.left - tolerance &&
      inner.right <= outer.right + tolerance &&
      inner.top >= outer.top - tolerance &&
      inner.bottom <= outer.bottom + tolerance;

    return Array.from(root.querySelectorAll('.question-tile.used.has-result')).flatMap((tile) => {
      if (!(tile instanceof HTMLElement)) return [];
      const tileRect = tile.getBoundingClientRect();
      const offenders = Array.from(tile.querySelectorAll('.used-tile-result, .used-result-list, .used-result-chip, .used-result-chip .player-avatar-art'))
        .filter((element) => element instanceof HTMLElement)
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return contains(tileRect, rect)
            ? null
            : {
                className: element.className,
                tile: [tileRect.left, tileRect.top, tileRect.right, tileRect.bottom],
                child: [rect.left, rect.top, rect.right, rect.bottom]
              };
        })
        .filter(Boolean);
      return offenders;
    });
  });
  expect(issues).toEqual([]);
}

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

async function instrumentFullscreenTarget(page) {
  await page.addInitScript(() => {
    const originalRequestFullscreen = Element.prototype.requestFullscreen;
    Object.defineProperty(Element.prototype, 'requestFullscreen', {
      configurable: true,
      value: async function (this: Element) {
        this.setAttribute('data-playwright-fullscreen-target', 'true');
        if (originalRequestFullscreen) return originalRequestFullscreen.call(this);
        throw new Error('Fullscreen API unavailable');
      }
    });
  });
}

async function openDevPresentationHarness(page, { playerCount = 5, multiplier = 2 } = {}) {
  await instrumentFullscreenTarget(page);
  await page.goto('/?mode=host&fresh=1');
  await page.getByRole('button', { name: 'Open developer mode' }).click();

  const panel = page.locator('.dev-mode-panel');
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: `${playerCount}P`, exact: true }).click();
  await panel.locator('label').filter({ hasText: 'Board modifier' }).locator('select').selectOption(String(multiplier));

  const lab = page.locator('.dev-visual-lab-section');
  await lab.getByRole('button', { name: 'Fullscreen Visual & animation lab' }).click();
  await expect(lab).toHaveAttribute('data-playwright-fullscreen-target', 'true');
  await expect(lab).toHaveAttribute('data-dev-visual-lab-fullscreen', 'true');

  const fullscreenState = await lab.evaluate((element) => ({
    native: document.fullscreenElement === element,
    fallback: element.classList.contains('is-fallback-fullscreen')
  }));
  expect(fullscreenState.native || fullscreenState.fallback).toBe(true);

  await lab.getByRole('button', { name: 'Presentation Mode', exact: true }).click();
  await expect(lab.locator('[data-dev-production-presentation="true"] .board-presentation-mode')).toBeVisible();
  return lab;
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

for (const viewport of viewports) {
  test(`production presentation board fits at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const lab = await openDevPresentationHarness(page, { playerCount: 5, multiplier: viewport.width === 1366 ? 3 : 2 });

    await expect(lab.locator('.presentation-name-card')).toHaveCount(5);
    await assertViewportFit(page, '.dev-board-presentation');
    await assertUsedResultTilesContained(page, '.dev-board-presentation');

    const geometry = await lab.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height, vw: innerWidth, vh: innerHeight };
    });
    expect(Math.abs(geometry.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.top)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.width - geometry.vw)).toBeLessThanOrEqual(2);
    expect(Math.abs(geometry.height - geometry.vh)).toBeLessThanOrEqual(2);
  });
}

test('production presentation lab supports 2-5 players through the DEV path', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await instrumentFullscreenTarget(page);
  await page.goto('/?mode=host&fresh=1');
  await page.getByRole('button', { name: 'Open developer mode' }).click();

  const panel = page.locator('.dev-mode-panel');
  const lab = page.locator('.dev-visual-lab-section');
  for (const count of [2, 3, 4, 5]) {
    await panel.getByRole('button', { name: `${count}P`, exact: true }).click();
    await lab.getByRole('button', { name: 'Fullscreen Visual & animation lab' }).click();
    await expect(lab).toHaveAttribute('data-dev-visual-lab-fullscreen', 'true');
    await lab.getByRole('button', { name: 'Presentation Mode', exact: true }).click();
    await expect(lab.locator('.presentation-name-card')).toHaveCount(count);
    await assertViewportFit(page, '.dev-board-presentation');
    await lab.getByRole('button', { name: 'Exit Fullscreen', exact: true }).click();
    await expect(lab).toHaveAttribute('data-dev-visual-lab-fullscreen', 'false');
    await expect(panel).toBeVisible();
  }
});

test('fullscreen DEV visual lab keeps dynamic overlays inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await instrumentFullscreenTarget(page);
  await page.goto('/?mode=host&fresh=1');
  await page.getByRole('button', { name: 'Open developer mode' }).click();

  const lab = page.locator('.dev-visual-lab-section');
  await lab.getByRole('button', { name: 'Fullscreen Visual & animation lab' }).click();
  await expect(lab.locator('[data-dev-expanded-lab="true"]')).toBeVisible();

  for (const label of ['Score +', 'Score −', '2× reveal', '3× reveal', 'Final reveal', 'Round start', 'Daily Double', 'Final Round', 'Results']) {
    await lab.getByRole('button', { name: label, exact: true }).click();
    await page.waitForTimeout(100);
    await assertViewportFit(page, '.dev-visual-lab-section');
    await lab.getByRole('button', { name: 'Clear previews', exact: true }).click();
  }

  await lab.getByRole('button', { name: 'Exit Fullscreen', exact: true }).click();
});

test('DEV visual lab fullscreen uses the exact lab element and real presentation UI', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const lab = await openDevPresentationHarness(page, { playerCount: 5, multiplier: 2 });

  await expect(lab.locator('[data-dev-production-presentation="true"]')).toBeVisible();
  await expect(lab.locator('.board-presentation-mode')).toBeVisible();

  await lab.getByRole('button', { name: 'Score +', exact: true }).click();
  await expect(lab.locator('.score-flight-token')).toBeVisible();
  await lab.getByRole('button', { name: 'Clear previews', exact: true }).click();

  await lab.getByRole('button', { name: '2× reveal', exact: true }).click();
  await expect(lab.locator('.modifier-reveal-overlay')).toBeVisible();
  await lab.getByRole('button', { name: 'Clear previews', exact: true }).click();

  await lab.getByRole('button', { name: 'Round start', exact: true }).click();
  await expect(lab.locator('.game-transition-overlay')).toBeVisible();
  await lab.getByRole('button', { name: 'Clear previews', exact: true }).click();

  const toolbar = lab.getByRole('toolbar', { name: 'Visual lab fullscreen controls' });
  await expect(toolbar).toBeVisible();
  await page.mouse.click(24, 430);
  await expect(toolbar).toHaveCount(0);
  await expect(lab.locator('.board-presentation-mode')).toBeVisible();

  await lab.getByRole('button', { name: 'LAB CONTROLS', exact: true }).click();
  await expect(toolbar).toBeVisible();
  await lab.getByRole('button', { name: 'Exit Fullscreen', exact: true }).click();

  await expect(lab).toHaveAttribute('data-dev-visual-lab-fullscreen', 'false');
  await expect(page.locator('.dev-mode-panel')).toBeVisible();
  await expect(lab.getByRole('button', { name: 'Fullscreen Visual & animation lab' })).toBeVisible();
});

test('dismissible host panels preserve inside clicks and close outside', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?mode=host&fresh=1');

  await page.getByRole('button', { name: /Audio/ }).click();
  const audioDrawer = page.locator('.audio-drawer');
  await expect(audioDrawer).toBeVisible();
  await audioDrawer.click({ position: { x: 20, y: 20 } });
  await expect(audioDrawer).toBeVisible();
  await page.mouse.click(800, 400);
  await expect(audioDrawer).toHaveCount(0);

  await page.getByRole('button', { name: 'Open developer mode' }).click();
  const devPanel = page.locator('.dev-mode-panel');
  await expect(devPanel).toBeVisible();
  await devPanel.click({ position: { x: 40, y: 40 } });
  await expect(devPanel).toBeVisible();
  await page.mouse.click(900, 400);
  await expect(devPanel).toHaveCount(0);

  await page.getByRole('button', { name: 'Join QR', exact: true }).click();
  const joinModal = page.locator('.expanded-qr-modal');
  await expect(joinModal).toBeVisible();
  await joinModal.click({ position: { x: 40, y: 40 } });
  await expect(joinModal).toBeVisible();
  await page.locator('.modal-backdrop').click({ position: { x: 10, y: 10 } });
  await expect(joinModal).toHaveCount(0);

  const hostControls = page.getByRole('button', { name: 'Open host controls' });
  await hostControls.click();
  const drawer = page.locator('.host-command-drawer');
  await expect(drawer).toBeVisible();
  await drawer.click({ position: { x: 30, y: 30 } });
  await expect(drawer).toBeVisible();

  await page.getByRole('button', { name: 'Connection check', exact: true }).click();
  const preflight = page.locator('.preflight-modal');
  await expect(preflight).toBeVisible();
  await preflight.click({ position: { x: 30, y: 30 } });
  await expect(preflight).toBeVisible();
  await page.locator('.enhancement-modal-backdrop').click({ position: { x: 10, y: 10 } });
  await expect(preflight).toHaveCount(0);
  await expect(drawer).toBeVisible();

  await page.mouse.click(900, 400);
  await expect(drawer).toHaveCount(0);
});


const phoneViewports = [
  { width: 360, height: 640 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 430, height: 932 }
];

async function assertEffectPreviewContained(page) {
  const result = await page.locator('[data-testid="player-customization-preview"]').evaluate((preview) => {
    if (!(preview instanceof HTMLElement)) throw new Error('Missing customization preview');
    const rect = (selector) => {
      const element = preview.querySelector(selector);
      if (!(element instanceof HTMLElement)) return null;
      const box = element.getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
    };
    const overlap = (a, b) => Boolean(a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top);
    const previewBox = preview.getBoundingClientRect();
    const slot = preview.querySelector('[data-testid="effect-preview-slot"]');
    if (!(slot instanceof HTMLElement)) return { hasSlot: false, contained: false, overlapsProtected: true, clipped: false };
    const slotBox = slot.getBoundingClientRect();
    const slotRect = { left: slotBox.left, top: slotBox.top, right: slotBox.right, bottom: slotBox.bottom };
    const protectedRects = [
      rect('.customization-preview-avatar'),
      rect('.customization-preview-copy'),
      rect('.customization-accent-bar')
    ].filter(Boolean);
    return {
      hasSlot: true,
      contained:
        slotBox.left >= previewBox.left - 1 &&
        slotBox.right <= previewBox.right + 1 &&
        slotBox.top >= previewBox.top - 1 &&
        slotBox.bottom <= previewBox.bottom + 1,
      overlapsProtected: protectedRects.some((item) => overlap(slotRect, item)),
      clipped: getComputedStyle(slot).overflow === 'hidden'
    };
  });

  expect(result.hasSlot).toBe(true);
  expect(result.contained).toBe(true);
  expect(result.overlapsProtected).toBe(false);
  expect(result.clipped).toBe(true);
}

async function assertAvatarFrameCentered(page, selector = '[data-testid="player-customization-preview"] .player-avatar-art') {
  const geometry = await page.locator(selector).first().evaluate((avatar) => {
    if (!(avatar instanceof HTMLElement)) throw new Error('Missing avatar');
    const frame = avatar.querySelector('.player-avatar-frame');
    const content = avatar.querySelector('.player-avatar-content');
    if (!(frame instanceof HTMLElement) || !(content instanceof HTMLElement)) throw new Error('Missing avatar layers');
    const outer = avatar.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    const center = (rect) => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    return {
      outer: { width: outer.width, height: outer.height },
      frame: { width: frameRect.width, height: frameRect.height },
      outerCenter: center(outer),
      frameCenter: center(frameRect),
      contentCenter: center(contentRect),
      insets: {
        left: frameRect.left - outer.left,
        right: outer.right - frameRect.right,
        top: frameRect.top - outer.top,
        bottom: outer.bottom - frameRect.bottom
      }
    };
  });

  expect(Math.abs(geometry.outer.width - geometry.outer.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.frame.width - geometry.frame.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.outerCenter.x - geometry.frameCenter.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.outerCenter.y - geometry.frameCenter.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.outerCenter.x - geometry.contentCenter.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.outerCenter.y - geometry.contentCenter.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.insets.left - geometry.insets.right)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.insets.top - geometry.insets.bottom)).toBeLessThanOrEqual(1);
}

async function readJoinLayout(page) {
  return page.locator('.join-form-v2').evaluate((card) => {
    if (!(card instanceof HTMLElement)) throw new Error('Missing join card');

    const required = (selector) => {
      const element = card.querySelector(selector);
      if (!(element instanceof HTMLElement)) throw new Error(`Missing ${selector}`);
      return element;
    };
    const box = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2
      };
    };
    const directNameLabel = Array.from(card.children).find((element) => element instanceof HTMLLabelElement);
    if (!(directNameLabel instanceof HTMLLabelElement)) throw new Error('Missing name label');
    const joinButton = Array.from(card.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Join Game');
    const backButton = Array.from(card.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Back to menu');
    if (!(joinButton instanceof HTMLElement) || !(backButton instanceof HTMLElement)) throw new Error('Missing join actions');

    const shell = document.querySelector('.phone-shell.phone-join');
    if (!(shell instanceof HTMLElement)) throw new Error('Missing join shell');
    const codeRow = required('.join-code-row');
    const codeInput = codeRow.querySelector('input');
    const scanButton = codeRow.querySelector('.scan-qr-button');
    const nameInput = directNameLabel.querySelector('input');
    if (!(codeInput instanceof HTMLElement) || !(scanButton instanceof HTMLElement) || !(nameInput instanceof HTMLElement)) {
      throw new Error('Missing join inputs');
    }

    const preview = required('[data-testid="player-customization-preview"]');
    const previewAvatar = required('.customization-preview-avatar');
    const accentBar = required('.customization-accent-bar');
    const tabs = required('.customization-tabs');
    const tabRects = Array.from(tabs.querySelectorAll('button')).map((button) => box(button));
    const categoryStrip = card.querySelector('.avatar-category-strip');
    const avatarGrid = card.querySelector('.avatar-grid-v3');
    const panel = required('.customization-panel');

    const visibleButtons = Array.from(card.querySelectorAll('button')).filter((button) => {
      const style = getComputedStyle(button);
      const rect = button.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    });

    return {
      viewport: {
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight
      },
      shell: box(shell),
      card: {
        ...box(card),
        clientWidth: card.clientWidth,
        scrollWidth: card.scrollWidth,
        clientHeight: card.clientHeight,
        scrollHeight: card.scrollHeight
      },
      brand: box(required('.phone-brand')),
      codeRow: box(codeRow),
      codeInput: box(codeInput),
      scanButton: box(scanButton),
      nameLabel: box(directNameLabel),
      nameInput: box(nameInput),
      customizer: box(required('.player-customizer')),
      preview: box(preview),
      previewAvatar: box(previewAvatar),
      accentBar: box(accentBar),
      tabs: box(tabs),
      tabRects,
      panel: box(panel),
      joinButton: box(joinButton),
      backButton: box(backButton),
      categoryStrip: categoryStrip instanceof HTMLElement
        ? { ...box(categoryStrip), clientWidth: categoryStrip.clientWidth, scrollWidth: categoryStrip.scrollWidth, scrollLeft: categoryStrip.scrollLeft }
        : null,
      avatarGrid: avatarGrid instanceof HTMLElement ? box(avatarGrid) : null,
      buttonMinimums: visibleButtons.map((button) => {
        const rect = button.getBoundingClientRect();
        return { width: rect.width, height: rect.height, text: button.textContent?.trim() ?? '' };
      })
    };
  });
}

async function assertJoinScreenGeometry(page) {
  const layout = await readJoinLayout(page);
  const tolerance = 2;
  const sameEdge = (a, b) => Math.abs(a - b) <= tolerance;

  expect(layout.viewport.scrollWidth).toBeLessThanOrEqual(layout.viewport.width + 1);
  expect(layout.viewport.scrollHeight).toBeLessThanOrEqual(layout.viewport.height + 1);
  expect(layout.card.left).toBeGreaterThanOrEqual(-1);
  expect(layout.card.right).toBeLessThanOrEqual(layout.viewport.width + 1);
  expect(layout.card.top).toBeGreaterThanOrEqual(-1);
  expect(layout.card.bottom).toBeLessThanOrEqual(layout.viewport.height + 1);
  expect(Math.abs(layout.card.centerX - layout.viewport.width / 2)).toBeLessThanOrEqual(1.5);
  expect(layout.card.scrollWidth).toBeLessThanOrEqual(layout.card.clientWidth + 1);
  expect(layout.card.scrollHeight).toBeLessThanOrEqual(layout.card.clientHeight + 1);

  expect(Math.abs(layout.brand.centerX - layout.card.centerX)).toBeLessThanOrEqual(1.5);
  expect(Math.abs(layout.backButton.centerX - layout.card.centerX)).toBeLessThanOrEqual(1.5);
  expect(Math.abs(layout.previewAvatar.centerY - layout.preview.centerY)).toBeLessThanOrEqual(1.5);
  expect(Math.abs(layout.accentBar.centerY - layout.preview.centerY)).toBeLessThanOrEqual(1.5);
  expect(Math.abs(layout.codeInput.bottom - layout.scanButton.bottom)).toBeLessThanOrEqual(1);
  expect(Math.abs(layout.codeInput.height - layout.scanButton.height)).toBeLessThanOrEqual(1);

  for (const section of [layout.codeRow, layout.nameLabel, layout.customizer, layout.joinButton]) {
    expect(sameEdge(section.left, layout.codeRow.left)).toBe(true);
    expect(sameEdge(section.right, layout.codeRow.right)).toBe(true);
  }

  expect(layout.panel.left).toBeGreaterThanOrEqual(layout.customizer.left - tolerance);
  expect(layout.panel.right).toBeLessThanOrEqual(layout.customizer.right + tolerance);

  const tabWidths = layout.tabRects.map((rect) => rect.width);
  const tabHeights = layout.tabRects.map((rect) => rect.height);
  expect(Math.max(...tabWidths) - Math.min(...tabWidths)).toBeLessThanOrEqual(1);
  expect(Math.max(...tabHeights) - Math.min(...tabHeights)).toBeLessThanOrEqual(1);

  for (const button of layout.buttonMinimums) {
    expect(button.width, `${button.text} width`).toBeGreaterThanOrEqual(39.5);
    expect(button.height, `${button.text} height`).toBeGreaterThanOrEqual(39.5);
  }

  if (layout.categoryStrip && layout.avatarGrid) {
    expect(sameEdge(layout.categoryStrip.left, layout.avatarGrid.left)).toBe(true);
    expect(sameEdge(layout.categoryStrip.right, layout.avatarGrid.right)).toBe(true);
    expect(layout.categoryStrip.scrollWidth).toBeGreaterThanOrEqual(layout.categoryStrip.clientWidth);
  }

  return layout;
}

async function elementSizes(page, selector) {
  return page.locator(selector).evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }));
}

for (const viewport of phoneViewports) {
  test(`join screen stays centered and stable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/?mode=player&room=ABCDE');

    const card = page.locator('.join-form-v2');
    const preview = page.locator('[data-testid="player-customization-preview"]');
    const nameInput = page.getByLabel('Your name');
    await expect(card).toBeVisible();
    await expect(preview).toBeVisible();
    await expect(page.getByRole('button', { name: 'Join Game' })).toBeVisible();
    await expect(preview.getByText('Your name', { exact: true })).toBeVisible();

    const avatarLayout = await assertJoinScreenGeometry(page);
    const baseCardWidth = avatarLayout.card.width;
    const basePreview = avatarLayout.preview;

    await nameInput.fill('A');
    await assertJoinScreenGeometry(page);
    await nameInput.fill('AlexandriaTheQuizMaster');
    await expect(preview.locator('.customization-preview-copy strong')).toHaveText('AlexandriaTheQuizMaster');
    const longNameLayout = await assertJoinScreenGeometry(page);
    expect(Math.abs(longNameLayout.card.width - baseCardWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(longNameLayout.preview.width - basePreview.width)).toBeLessThanOrEqual(1);
    await nameInput.fill('');
    await expect(preview.getByText('Your name', { exact: true })).toBeVisible();

    const avatarSizesBefore = await elementSizes(page, '.avatar-grid-v3 > button');
    await page.getByRole('button', { name: 'Owl', exact: true }).click();
    const avatarSizesAfter = await elementSizes(page, '.avatar-grid-v3 > button');
    expect(avatarSizesAfter).toEqual(avatarSizesBefore);
    await assertJoinScreenGeometry(page);

    const abstractCategory = page.getByRole('button', { name: 'Abstract', exact: true });
    await abstractCategory.click();
    const categoryScroll = await page.locator('.avatar-category-strip').evaluate((strip) => ({
      clientWidth: strip.clientWidth,
      scrollWidth: strip.scrollWidth,
      scrollLeft: strip.scrollLeft
    }));
    expect(categoryScroll.scrollWidth).toBeGreaterThan(categoryScroll.clientWidth);
    expect(categoryScroll.scrollLeft).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Prism', exact: true }).click();
    await assertAvatarFrameCentered(page);
    await assertJoinScreenGeometry(page);

    const tabSizesBefore = await elementSizes(page, '.customization-tabs button');
    await page.getByRole('tab', { name: 'Style' }).click();
    const tabSizesAfter = await elementSizes(page, '.customization-tabs button');
    expect(tabSizesAfter).toEqual(tabSizesBefore);
    const styleLayout = await assertJoinScreenGeometry(page);
    expect(Math.abs(styleLayout.card.width - baseCardWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(styleLayout.preview.width - basePreview.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(styleLayout.preview.height - basePreview.height)).toBeLessThanOrEqual(1);

    await page.getByRole('button', { name: 'Mint' }).click();
    const accentSwatch = page.getByRole('button', { name: 'Mint' });
    const accentBounds = await accentSwatch.boundingBox();
    expect(accentBounds).not.toBeNull();
    expect(Math.abs(accentBounds!.width - accentBounds!.height)).toBeLessThanOrEqual(1);
    await page.getByRole('button', { name: 'Halo' }).click();
    await expect(page.getByText('Title', { exact: true })).toHaveCount(0);
    await expect(page.locator('.player-title-badge')).toHaveCount(0);
    await expect(preview.locator('[data-frame="halo"]')).toBeVisible();
    await assertAvatarFrameCentered(page);
    const mobileEmojiTranslateY = await preview.locator('.player-avatar-emoji').evaluate((emoji) => {
      if (!(emoji instanceof HTMLElement)) throw new Error('Missing preview avatar');
      return new DOMMatrix(getComputedStyle(emoji).transform).m42;
    });
    expect(mobileEmojiTranslateY).toBeLessThan(0);
    expect(mobileEmojiTranslateY).toBeGreaterThanOrEqual(-2.5);
    await expect(preview).toHaveCSS('--accent', '#5eead4');

    await page.getByRole('tab', { name: 'Effects' }).click();
    const effectsLayout = await assertJoinScreenGeometry(page);
    expect(Math.abs(effectsLayout.card.width - baseCardWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(effectsLayout.preview.width - basePreview.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(effectsLayout.preview.height - basePreview.height)).toBeLessThanOrEqual(1);
    await expect(page.locator('[data-testid="effect-preview-slot"]')).toBeVisible();
    await assertEffectPreviewContained(page);

    for (const buzzer of ['Classic', 'Laser', 'Chime', 'Arcade']) {
      await page.locator('.customization-effects-panel').getByRole('button', { name: buzzer, exact: true }).click();
      await expect(preview).toHaveAttribute('data-preview-kind', 'buzzer');
      await expect(page.locator('.effect-preview-buzz')).toBeVisible();
      await assertEffectPreviewContained(page);
    }

    for (const score of [['Pulse', 'pulse', 1], ['Spark', 'spark', 8], ['Wave', 'wave', 2]]) {
      await page.locator('.customization-effects-panel').getByRole('button', { name: score[0], exact: true }).click();
      await expect(preview).toHaveAttribute('data-score-effect', score[1]);
      await expect(preview).toHaveAttribute('data-preview-kind', 'score');
      await expect(page.locator('.effect-preview-score')).toBeVisible();
      const layer = page.locator(`[data-testid="effect-preview-slot"] .score-impact-layer[data-score-effect="${score[1]}"][data-polarity="positive"]`);
      await expect(layer).toHaveCount(1);
      expect(await layer.locator('i').count()).toBe(score[2]);
      await assertEffectPreviewContained(page);
    }

    for (const victory of [['Confetti', 'confetti'], ['Spotlight', 'spotlight'], ['Stars', 'stars']]) {
      await page.locator('.customization-effects-panel').getByRole('button', { name: victory[0], exact: true }).click();
      await expect(preview).toHaveAttribute('data-victory-effect', victory[1]);
      await expect(preview).toHaveAttribute('data-preview-kind', 'victory');
      await assertEffectPreviewContained(page);
    }

    await assertJoinScreenGeometry(page);
    await page.getByRole('tab', { name: 'Avatar' }).click();
    await page.getByRole('button', { name: 'Robots' }).click();
    await page.getByRole('button', { name: 'Robot', exact: true }).click();
    const selectedAvatar = preview.locator('[data-avatar-id="bot-atlas"]');
    await expect(selectedAvatar).toBeVisible();
    await expect(selectedAvatar.locator('.player-avatar-emoji')).toHaveText('🤖');
    await assertAvatarFrameCentered(page);
    await assertJoinScreenGeometry(page);
  });
}

test('join style choices keep selection geometry stable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?mode=player&room=ABCDE');
  await page.getByRole('tab', { name: 'Style' }).click();

  const card = page.locator('.join-form-v2');
  const preview = page.locator('[data-testid="player-customization-preview"]');
  const baseCard = await card.boundingBox();
  const basePreview = await preview.boundingBox();
  expect(baseCard).not.toBeNull();
  expect(basePreview).not.toBeNull();

  const accentSizes = await elementSizes(page, '.accent-grid-v3 button');
  for (const accent of ['Gold', 'Mint', 'Sky', 'Rose', 'Violet', 'Orange', 'Green', 'Cyan']) {
    await page.getByRole('button', { name: accent, exact: true }).click();
    expect(await elementSizes(page, '.accent-grid-v3 button')).toEqual(accentSizes);
    await assertJoinScreenGeometry(page);
  }

  const frameSizes = await elementSizes(page, '.choice-row-v3 button');
  for (const frame of ['Clean', 'Halo', 'Bracket', 'Neon']) {
    await page.getByRole('button', { name: frame, exact: true }).click();
    expect(await elementSizes(page, '.choice-row-v3 button')).toEqual(frameSizes);
    await assertAvatarFrameCentered(page);
    await assertJoinScreenGeometry(page);
  }

  const finalCard = await card.boundingBox();
  const finalPreview = await preview.boundingBox();
  expect(finalCard).not.toBeNull();
  expect(finalPreview).not.toBeNull();
  expect(Math.abs(finalCard!.width - baseCard!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(finalPreview!.width - basePreview!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(finalPreview!.height - basePreview!.height)).toBeLessThanOrEqual(1);
});


test('avatar frames stay centered across frame and representative avatar shapes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?mode=player&room=ABCDE');

  await page.getByRole('tab', { name: 'Style' }).click();
  for (const frame of ['Clean', 'Halo', 'Bracket', 'Neon']) {
    await page.getByRole('button', { name: frame, exact: true }).click();
    await assertAvatarFrameCentered(page);
  }

  await page.getByRole('button', { name: 'Halo', exact: true }).click();
  await page.getByRole('tab', { name: 'Avatar' }).click();
  const samples = [
    ['Animals', 'Fox'],
    ['Robots', 'Robot'],
    ['Fantasy', 'Mage'],
    ['Space', 'Satellite'],
    ['Retro', 'Pixel Alien'],
    ['Weird', 'Moai']
  ];
  for (const [category, avatar] of samples) {
    await page.getByRole('button', { name: category, exact: true }).click();
    await page.getByRole('button', { name: avatar, exact: true }).click();
    await assertAvatarFrameCentered(page);
  }
});

for (const [label, effect, particles] of [
  ['Pulse', 'pulse', 1],
  ['Spark', 'spark', 8],
  ['Wave', 'wave', 2]
]) {
  test(`${label} is distinct for positive and negative real score impacts`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?mode=host&fresh=1');
    await page.getByRole('button', { name: 'Open developer mode' }).click();
    const panel = page.locator('.dev-mode-panel');
    await expect(panel).toBeVisible();

    const setEffect = async () => {
      await page.locator('[data-player-id="dev-player-2"]').evaluateAll((surfaces, selectedEffect) => {
        for (const surface of surfaces) {
          if (surface instanceof HTMLElement) surface.dataset.scoreEffect = String(selectedEffect);
        }
      }, effect);
    };
    const scoreTarget = page.locator('[data-player-score="dev-player-2"]:visible').last();
    const scoreValue = async () => Number(((await scoreTarget.textContent()) ?? '0').replace(/[^0-9-]/g, ''));
    const initialScore = await scoreValue();

    await setEffect();
    await panel.getByRole('button', { name: 'Score +', exact: true }).click();
    await expect(scoreTarget).toHaveClass(new RegExp(`score-impact-${effect}.*score-impact-positive`), { timeout: 3500 });
    let layer = page.locator(`.score-impact-layer[data-score-target="dev-player-2"][data-score-effect="${effect}"][data-polarity="positive"]`);
    await expect(layer).toHaveCount(1);
    expect(await layer.locator('i').count()).toBe(particles);
    await expect.poll(scoreValue).toBeGreaterThan(initialScore);
    const positiveScore = await scoreValue();
    await expect(scoreTarget).not.toHaveClass(/score-impact-active/, { timeout: 3500 });

    await setEffect();
    await panel.getByRole('button', { name: 'Score −', exact: true }).click();
    await expect(scoreTarget).toHaveClass(new RegExp(`score-impact-${effect}.*score-impact-negative`), { timeout: 3500 });
    layer = page.locator(`.score-impact-layer[data-score-target="dev-player-2"][data-score-effect="${effect}"][data-polarity="negative"]`);
    await expect(layer).toHaveCount(1);
    expect(await layer.locator('i').count()).toBe(particles);
    await expect.poll(scoreValue).toBeLessThan(positiveScore);
  });
}

test('score effects use a reduced-motion fallback without animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?mode=host&fresh=1');
  await page.getByRole('button', { name: 'Open developer mode' }).click();
  const panel = page.locator('.dev-mode-panel');
  await page.locator('[data-player-id="dev-player-2"]').evaluateAll((surfaces) => {
    for (const surface of surfaces) {
      if (surface instanceof HTMLElement) surface.dataset.scoreEffect = 'wave';
    }
  });

  const scoreTarget = page.locator('[data-player-score="dev-player-2"]:visible').last();
  await panel.getByRole('button', { name: 'Score +', exact: true }).click();
  await expect(scoreTarget).toHaveClass(/score-impact-wave.*score-impact-reduced/, { timeout: 3500 });
  expect(await scoreTarget.evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
});
