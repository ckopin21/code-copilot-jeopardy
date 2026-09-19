/* global process, fetch, console, setTimeout, clearTimeout, window, document, innerWidth, innerHeight, getComputedStyle, localStorage */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const baseUrl = 'http://127.0.0.1:4173/';
const artifactDir = 'artifacts/ui-layout';
await mkdir(artifactDir, { recursive: true });

const server = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '4173'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, BROWSER: 'none' }
});
let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += chunk.toString(); });
server.stderr.on('data', (chunk) => { serverLog += chunk.toString(); });

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch { /* retry until the dev server is ready */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Vite did not start.\n${serverLog}`);
}

function safeName(value) {
  return value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 120);
}

async function capture(page, label) {
  try {
    await page.screenshot({ path: `${artifactDir}/${safeName(label)}.png`, fullPage: true });
  } catch { /* screenshots are best-effort diagnostics */ }
}

async function auditLayout(page, label) {
  const issues = await page.evaluate((auditLabel) => {
    const failures = [];
    const tolerance = 2;
    const viewport = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && rect.width > .5 && rect.height > .5;
    };
    const box = (rect) => ({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height });
    const outside = (inner, outer, extra = tolerance) =>
      inner.left < outer.left - extra || inner.top < outer.top - extra || inner.right > outer.right + extra || inner.bottom > outer.bottom + extra;
    const intersectionArea = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

    if (document.documentElement.scrollWidth > innerWidth + tolerance) {
      failures.push(`${auditLabel}: document is ${document.documentElement.scrollWidth - innerWidth}px wider than viewport`);
    }

    const viewportSelectors = [
      '.showcase-player-strip',
      '.showcase-player-card',
      '.board',
      '.category-tile',
      '.question-tile',
      '.used-tile-result',
      '.used-result-chip',
      '.used-question-modifiers',
      '.used-result-modifiers',
      '.board-presentation-mode',
      '.board-presentation-header',
      '.presentation-name-strip',
      '.presentation-name-card',
      '.presentation-board-fill',
      '.presentation-question > article',
      '.question-card-v2',
      '.state-card',
      '.daily-double-burst',
      '.modifier-banner',
      '.modifier-reveal-card',
      '.final-reveal-card',
      '.game-transition-overlay > section',
      '.comeback-boost-notice',
      '.podium-scene',
      '.podium-ranking',
      '.podium-card',
      '.recap-scene-v2',
      '.recap-card-v2',
      '.presentation-scores-v2'
    ];
    for (const element of document.querySelectorAll(viewportSelectors.join(','))) {
      if (!visible(element)) continue;
      const rect = box(element.getBoundingClientRect());
      if (outside(rect, viewport, 3)) {
        failures.push(`${auditLabel}: ${element.className || element.tagName} leaves viewport: ${JSON.stringify(rect)}`);
      }
    }

    const textSelectors = [
      '.player-name strong',
      '.presentation-player-main strong',
      '.presentation-name-card strong',
      '.presentation-final-player h1',
      '.presentation-scores-v2 span',
      '.used-result-chip b',
      '.used-result-modifiers i',
      '.used-question-modifiers span',
      '.turn-beacon b',
      '.roster-row strong',
      '.score-controls-v2 span',
      '.attempt-row strong',
      '.submission-list-v2 strong',
      '.podium-name',
      '.recap-player-heading h2',
      '.category-tile',
      '.question-meta-v2 span',
      '.question-meta-v2 strong'
    ];
    for (const element of document.querySelectorAll(textSelectors.join(','))) {
      if (!visible(element) || !element.textContent?.trim()) continue;
      const style = getComputedStyle(element);
      if (style.textOverflow === 'ellipsis') failures.push(`${auditLabel}: ellipsis still active on "${element.textContent.trim().slice(0, 80)}"`);
      const horizontalClip = element.scrollWidth > element.clientWidth + 1 && ['hidden', 'clip'].includes(style.overflowX);
      const verticalClip = element.scrollHeight > element.clientHeight + 1 && ['hidden', 'clip'].includes(style.overflowY);
      if (horizontalClip || verticalClip) {
        failures.push(`${auditLabel}: clipped text in ${element.className || element.tagName} "${element.textContent.trim().slice(0, 80)}"`);
      }
    }

    const containment = [
      ['.showcase-player-card', '.player-avatar-large,.player-card-main,.streak-ribbon,.player-status-stack,.turn-beacon'],
      ['.question-tile.used.has-result', '.used-tile-result,.used-result-chip,.used-question-modifiers,.used-result-modifiers'],
      ['.presentation-name-card', '.presentation-player-avatar,.presentation-player-main,[data-player-score]']
    ];
    for (const [parentSelector, childSelector] of containment) {
      for (const parent of document.querySelectorAll(parentSelector)) {
        if (!visible(parent)) continue;
        const parentRect = box(parent.getBoundingClientRect());
        for (const child of parent.querySelectorAll(childSelector)) {
          if (!visible(child)) continue;
          const childRect = box(child.getBoundingClientRect());
          if (outside(childRect, parentRect, 3)) {
            failures.push(`${auditLabel}: ${child.className || child.tagName} escapes ${parent.className || parent.tagName}`);
          }
        }
      }
    }

    const siblingGroups = [
      ['.showcase-player-strip', ':scope > .showcase-player-card'],
      ['.presentation-name-strip', ':scope > .presentation-name-card'],
      ['.board', ':scope > .category-tile,:scope > .question-tile']
    ];
    for (const [containerSelector, childSelector] of siblingGroups) {
      for (const container of document.querySelectorAll(containerSelector)) {
        if (!visible(container)) continue;
        const children = [...container.querySelectorAll(childSelector)].filter(visible);
        for (let i = 0; i < children.length; i += 1) {
          for (let j = i + 1; j < children.length; j += 1) {
            const a = box(children[i].getBoundingClientRect());
            const b = box(children[j].getBoundingClientRect());
            if (intersectionArea(a, b) > 2) {
              failures.push(`${auditLabel}: sibling overlap between ${children[i].className || children[i].tagName} and ${children[j].className || children[j].tagName}`);
              i = children.length;
              break;
            }
          }
        }
      }
    }

    for (const selector of ['.showcase-board-stage', '.board-presentation-mode', '.presentation-shell']) {
      const element = document.querySelector(selector);
      if (!element || !visible(element)) continue;
      const style = getComputedStyle(element);
      if (element.scrollWidth > element.clientWidth + 2 && ['hidden', 'clip'].includes(style.overflowX)) failures.push(`${auditLabel}: ${selector} clips horizontal content`);
      if (element.scrollHeight > element.clientHeight + 2 && ['hidden', 'clip'].includes(style.overflowY)) failures.push(`${auditLabel}: ${selector} clips vertical content`);
    }

    return [...new Set(failures)];
  }, label);

  if (issues.length) {
    await capture(page, label);
    throw new Error(issues.join('\n'));
  }
}

async function hostAction(page, event, payload = {}) {
  return page.evaluate(async ({ eventName, body }) => {
    const [{ emitAck }, { readActiveHostCredentials }] = await Promise.all([
      import('/src/lib/socket.ts'),
      import('/src/lib/hostCredentials.ts')
    ]);
    const credentials = readActiveHostCredentials();
    if (!credentials) throw new Error('Host credentials unavailable');
    return emitAck(eventName, { roomCode: credentials.roomCode, hostToken: credentials.hostToken, ...body });
  }, { eventName: event, body: payload });
}

async function hostSnapshot(page) {
  return page.evaluate(async () => {
    const { socket } = await import('/src/lib/socket.ts');
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        socket.off('room:state', onState);
        reject(new Error('Timed out waiting for host room state'));
      }, 4_000);
      const onState = (snapshot) => {
        window.clearTimeout(timeout);
        socket.off('room:state', onState);
        resolve(snapshot);
      };
      socket.on('room:state', onState);
    });
  });
}

async function playerAction(page, event, payload = {}) {
  return page.evaluate(async ({ eventName, body }) => {
    const raw = localStorage.getItem('blue-stage-player');
    if (!raw) throw new Error('Player credentials unavailable');
    const credentials = JSON.parse(raw);
    const { emitAck } = await import('/src/lib/socket.ts');
    return emitAck(eventName, { ...credentials, ...body });
  }, { eventName: event, body: payload });
}

async function waitForAny(page, selectors, timeout = 8_000) {
  await page.waitForFunction((items) => items.some((selector) => {
    const element = document.querySelector(selector);
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  }), selectors, { timeout });
}

async function runHarnessAudits(browser) {
  const matrix = [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 1280, height: 720 },
    { width: 1024, height: 768 }
  ];
  const cases = ['players', 'board', 'board-presentation', 'presentation-question'];

  for (const viewport of matrix) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    for (const testCase of cases) {
      const label = `harness-${testCase}-${viewport.width}x${viewport.height}`;
      await page.goto(`${baseUrl}?layoutAudit=1&case=${testCase}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('.ui-audit-harness,.board-presentation-mode', { state: 'visible' });
      await auditLayout(page, label);
    }
    if (viewport.width === 1440 || viewport.width === 1024) {
      const label = `harness-endgame-${viewport.width}x${viewport.height}`;
      await page.goto(`${baseUrl}?layoutAudit=1&case=endgame`, { waitUntil: 'networkidle' });
      await page.waitForSelector('.podium-scene', { state: 'visible' });
      await page.waitForTimeout(7_100);
      await auditLayout(page, label);
      const stats = page.getByRole('button', { name: 'View Game Stats' });
      if (await stats.isVisible()) {
        await stats.click();
        await page.waitForSelector('.stats-after-podium', { state: 'visible' });
        await auditLayout(page, `${label}-stats`);
      }
    }
    await context.close();
  }
}

async function openPlayers(browser, roomCode, count = 5) {
  const names = ['Alexandria Montgomery', 'Christopher Rodriguez', 'Maximilian Kensington', 'Samantha OCallaghan', 'Benjamin Fitzpatrick'];
  const players = [];
  for (let index = 0; index < count; index += 1) {
    const context = await browser.newContext({ viewport: { width: 430, height: 860 } });
    const page = await context.newPage();
    await page.goto(`${baseUrl}?mode=player&room=${roomCode}`, { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('Player name').fill(names[index]);
    await page.getByRole('button', { name: 'Join Game' }).click();
    await page.waitForSelector('.player-phone-v2', { state: 'visible', timeout: 15_000 });
    players.push({ context, page });
  }
  return players;
}

async function runDevDynamicAudit(hostPage, labelPrefix) {
  await hostPage.getByRole('button', { name: 'Open developer mode' }).click();
  await hostPage.waitForSelector('.dev-mode-panel', { state: 'visible' });
  const panel = hostPage.locator('.dev-mode-panel');
  await panel.getByRole('button', { name: '5P' }).click();
  await panel.locator('select').filter({ has: hostPage.locator('option[value="fire"]') }).selectOption('fire').catch(() => {});
  await auditLayout(hostPage, `${labelPrefix}-dev-five-player`);

  await panel.getByRole('button', { name: 'Score +' }).click();
  await hostPage.waitForTimeout(120);
  const flight = hostPage.locator('.score-flight-token');
  if (await flight.count()) {
    const rect = await flight.first().boundingBox();
    if (rect && (rect.x < -2 || rect.y < -2 || rect.x + rect.width > (await hostPage.evaluate(() => innerWidth)) + 2 || rect.y + rect.height > (await hostPage.evaluate(() => innerHeight)) + 2)) {
      await capture(hostPage, `${labelPrefix}-score-flight`);
      throw new Error(`${labelPrefix}: score flight leaves viewport`);
    }
  }
  await hostPage.waitForTimeout(900);

  for (const name of ['2× reveal', '3× reveal', 'Final reveal', 'Daily Double', 'Final Round', 'Results']) {
    await panel.getByRole('button', { name }).click();
    await hostPage.waitForTimeout(120);
    await auditLayout(hostPage, `${labelPrefix}-dev-${safeName(name)}`);
    await panel.getByRole('button', { name: 'Clear previews' }).click();
  }

  await panel.getByRole('button', { name: '2P' }).click();
  const comeback = panel.getByRole('button', { name: 'Comeback banner' });
  if (await comeback.isEnabled()) {
    await comeback.click();
    await hostPage.waitForTimeout(80);
    await auditLayout(hostPage, `${labelPrefix}-dev-comeback`);
    await panel.getByRole('button', { name: 'Clear previews' }).click();
  }

  await hostPage.getByRole('button', { name: 'Close developer mode' }).click();
}

async function playQuestion({ hostPage, players, mode, questionIndex, gameStartedAt, playerIds }) {
  const tile = hostPage.locator('.showcase-board-stage .question-tile:not(.used):not(.empty)').first();
  const questionId = await tile.getAttribute('data-question-id');
  if (!questionId) throw new Error('No selectable board question found');

  await hostAction(hostPage, 'host:select-question', {
    questionId,
    dailyDoublePlayerId: playerIds[questionIndex % playerIds.length]
  });
  await waitForAny(hostPage, ['.question-stage', '.daily-double-burst']);

  if (await hostPage.locator('.daily-double-burst').count()) {
    await auditLayout(hostPage, `${mode}-daily-double-wager`);
    await hostAction(hostPage, 'host:daily-double-wager', { wager: 100 });
    await waitForAny(hostPage, ['.question-stage']);
    await auditLayout(hostPage, `${mode}-daily-double-question`);
    await hostAction(hostPage, 'host:reveal-answer');
    await hostAction(hostPage, 'host:resolve-answer', { playerId: playerIds[questionIndex % playerIds.length], correct: questionIndex % 2 === 0 });
    await hostAction(hostPage, 'host:advance-board');
    return { dailyDouble: true };
  }

  if (mode === 'classic') {
    const playerId = questionIndex < 4 ? playerIds[0] : playerIds[questionIndex % playerIds.length];
    await hostAction(hostPage, 'host:open-buzzers');
    await hostAction(hostPage, 'host:local-buzz', { playerId });
    await hostAction(hostPage, 'host:reveal-answer');
    await auditLayout(hostPage, `${mode}-question-revealed-${questionIndex}`);
    await hostAction(hostPage, 'host:resolve-answer', { playerId, correct: questionIndex < 4 || questionIndex % 2 === 0 });
  } else {
    for (let index = 0; index < players.length; index += 1) {
      await playerAction(players[index].page, 'player:text-response', {
        answer: `simultaneous answer ${index + 1}`,
        questionId,
        gameStartedAt
      });
    }
    await hostAction(hostPage, 'host:reveal-answer');
    await auditLayout(hostPage, `${mode}-multi-response-reveal-${questionIndex}`);
    for (let index = 0; index < playerIds.length; index += 1) {
      await hostAction(hostPage, 'host:resolve-text', { playerId: playerIds[index], correct: (questionIndex + index) % 2 === 0 });
    }
    await hostAction(hostPage, 'host:confirm-text-grades');
  }

  await hostAction(hostPage, 'host:advance-board');
  return { dailyDouble: false };
}

async function runLiveGame(browser, mode, viewport) {
  const hostContext = await browser.newContext({ viewport });
  const hostPage = await hostContext.newPage();
  const labelPrefix = `live-${mode}-${viewport.width}x${viewport.height}`;
  await hostPage.goto(`${baseUrl}?mode=host&fresh=1`, { waitUntil: 'domcontentloaded' });
  await hostPage.waitForSelector('.showcase-lobby', { state: 'visible', timeout: 20_000 });
  const roomCode = (await hostPage.locator('.room-code strong').textContent())?.trim();
  if (!roomCode) throw new Error('Room code missing');

  const players = await openPlayers(browser, roomCode, 5);
  try {
    await hostPage.waitForFunction(() => document.querySelectorAll('.roster-row').length >= 5, null, { timeout: 15_000 });
    const playerIds = await hostPage.locator('.roster-row').evaluateAll((rows) => rows.map((row) => row.getAttribute('data-player-id')).filter(Boolean));
    let ids = playerIds;
    if (ids.length < 5) {
      ids = await hostPage.evaluate(async () => {
        const { socket } = await import('/src/lib/socket.ts');
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => { socket.off('room:state', onState); reject(new Error('No room snapshot')); }, 4_000);
          const onState = (room) => { clearTimeout(timer); socket.off('room:state', onState); resolve(room.players.filter((player) => player.connected).map((player) => player.id)); };
          socket.on('room:state', onState);
        });
      });
    }
    if (ids.length !== 5) throw new Error(`Expected 5 live players, found ${ids.length}`);

    await hostAction(hostPage, 'host:update-settings', {
      updates: {
        gameMode: mode,
        gameLength: 'quick',
        randomizeCategories: false,
        dailyDoublesEnabled: mode === 'classic',
        dailyDoubleCount: mode === 'classic' ? 1 : 0,
        timerSeconds: null,
        freeResponseReadSeconds: 0,
        lateGameModifiers: true,
        streaksEnabled: true,
        finalRoundEnabled: true,
        lockRoomOnStart: false,
        turnOrderMode: 'join-order'
      }
    });

    if (mode === 'classic') await runDevDynamicAudit(hostPage, labelPrefix);

    await hostAction(hostPage, 'host:start-game');
    await waitForAny(hostPage, ['.showcase-board-stage']);
    await hostPage.waitForTimeout(150);
    const transition = hostPage.locator('.game-transition-overlay');
    if (await transition.count()) await auditLayout(hostPage, `${labelPrefix}-round-start-transition`);
    await hostPage.waitForTimeout(5_500);
    await auditLayout(hostPage, `${labelPrefix}-early-board`);

    await hostPage.getByRole('button', { name: 'Presentation' }).click();
    await hostPage.waitForSelector('.board-presentation-mode', { state: 'visible' });
    await auditLayout(hostPage, `${labelPrefix}-host-presentation-board`);
    await hostPage.getByRole('button', { name: '← Back' }).click();

    await hostAction(hostPage, 'host:pause');
    await waitForAny(hostPage, ['.full-state']);
    await auditLayout(hostPage, `${labelPrefix}-paused`);
    await hostAction(hostPage, 'host:resume');
    await waitForAny(hostPage, ['.showcase-board-stage']);

    const startSnapshot = await hostSnapshot(hostPage);
    const gameStartedAt = startSnapshot.gameStartedAt;
    if (!gameStartedAt) throw new Error('Missing gameStartedAt');

    let questionIndex = 0;
    let sawDailyDouble = mode !== 'classic';
    let sawDouble = false;
    let sawTriple = false;
    while (await hostPage.locator('.showcase-board-stage .question-tile:not(.used):not(.empty)').count()) {
      const result = await playQuestion({ hostPage, players, mode, questionIndex, gameStartedAt, playerIds: ids });
      sawDailyDouble ||= result.dailyDouble;
      questionIndex += 1;

      if (await hostPage.locator('.showcase-board-stage').count()) {
        if (questionIndex === 1 || result.dailyDouble) await auditLayout(hostPage, `${labelPrefix}-board-results-${questionIndex}`);
        if (!sawDouble && await hostPage.locator('.modifier-banner.x2').count()) {
          sawDouble = true;
          await auditLayout(hostPage, `${labelPrefix}-double-points-board`);
          if (await hostPage.locator('.modifier-reveal-overlay.x2').count()) await auditLayout(hostPage, `${labelPrefix}-double-points-reveal`);
        }
        if (!sawTriple && await hostPage.locator('.modifier-banner.x3').count()) {
          sawTriple = true;
          await auditLayout(hostPage, `${labelPrefix}-triple-points-board`);
          if (await hostPage.locator('.modifier-reveal-overlay.x3').count()) await auditLayout(hostPage, `${labelPrefix}-triple-points-reveal`);
        }
      }
      if (questionIndex > 24) throw new Error('Game did not progress to endgame');
    }

    if (!sawDailyDouble) throw new Error('Classic live pass never triggered its Daily Double');
    if (!sawDouble || !sawTriple) throw new Error(`Late modifiers missing: double=${sawDouble} triple=${sawTriple}`);

    await waitForAny(hostPage, ['.final-stage-v2', '.final-stage', '.question-stage', '.full-state', '.game-transition-overlay'], 10_000);
    await auditLayout(hostPage, `${labelPrefix}-final-category`);
    await hostAction(hostPage, 'host:begin-final-wagers');
    await hostPage.waitForTimeout(100);
    await auditLayout(hostPage, `${labelPrefix}-final-wager`);

    for (const player of players) {
      await playerAction(player.page, 'player:final-wager', { wager: 0, gameStartedAt });
    }
    await hostAction(hostPage, 'host:open-final-question');
    await hostPage.waitForTimeout(100);
    await auditLayout(hostPage, `${labelPrefix}-final-question`);

    for (let index = 0; index < players.length; index += 1) {
      await playerAction(players[index].page, 'player:final-answer', { answer: `final answer ${index + 1}`, gameStartedAt });
    }
    await hostAction(hostPage, 'host:begin-final-review');
    await hostPage.waitForTimeout(100);
    await auditLayout(hostPage, `${labelPrefix}-final-review`);

    for (let guard = 0; guard < 8; guard += 1) {
      const snapshot = await hostSnapshot(hostPage);
      if (snapshot.phase !== 'final-review') break;
      const playerId = snapshot.finalRound?.reviewPlayerId ?? snapshot.finalRound?.participantIds?.[snapshot.finalRound?.reviewPlayerIndex ?? 0];
      if (!playerId) throw new Error('Final review player missing');
      await hostAction(hostPage, 'host:resolve-final', { playerId, correct: guard % 2 === 0 });
      await hostPage.waitForTimeout(80);
    }

    await waitForAny(hostPage, ['.podium-scene', '.recap-scene-v2'], 10_000);
    await auditLayout(hostPage, `${labelPrefix}-results-hold`);
    await hostPage.waitForTimeout(7_100);
    await auditLayout(hostPage, `${labelPrefix}-podium`);
    const statsButton = hostPage.getByRole('button', { name: 'View Game Stats' });
    if (await statsButton.isVisible()) {
      await statsButton.click();
      await hostPage.waitForSelector('.stats-after-podium', { state: 'visible' });
      await auditLayout(hostPage, `${labelPrefix}-results-stats`);
    }
  } finally {
    for (const player of players) await player.context.close();
    await hostContext.close();
  }
}

let browser;
const failures = [];
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });

  for (const run of [
    ['harness', () => runHarnessAudits(browser)],
    ['classic-live', () => runLiveGame(browser, 'classic', { width: 1440, height: 900 })],
    ['free-response-live', () => runLiveGame(browser, 'free-response', { width: 1280, height: 720 })]
  ]) {
    try {
      await run[1]();
    } catch (error) {
      failures.push(`${run[0]}: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    }
  }
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
  await writeFile(`${artifactDir}/vite.log`, serverLog);
}

if (failures.length) {
  await writeFile(`${artifactDir}/failures.txt`, failures.join('\n\n'));
  throw new Error(failures.join('\n\n'));
}

console.log('UI layout audit passed: deterministic stress harness + full Classic/Free Response live games.');
