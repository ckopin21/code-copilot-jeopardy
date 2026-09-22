import { expect, test } from '@playwright/test';

test('authoritative score events animate the correct remote display card and display links can be revoked', async ({ browser, baseURL }) => {
  test.setTimeout(90_000);
  const hostContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const playerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const secondPlayerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const displayContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const latePlayerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const host = await hostContext.newPage();
  const player = await playerContext.newPage();
  const secondPlayer = await secondPlayerContext.newPage();
  const display = await displayContext.newPage();
  const latePlayer = await latePlayerContext.newPage();
  try {
    await host.goto(`${baseURL}/?mode=host&fresh=1`);
    await expect(host.getByRole('button', { name: 'Start Game' })).toBeVisible();
    const credentials = await host.evaluate(() => JSON.parse(localStorage.getItem('blue-stage-host-room') ?? 'null') as { roomCode: string; presentationUrl: string } | null);
    expect(credentials?.roomCode).toMatch(/^[A-Z0-9]{5}$/);
    expect(credentials?.presentationUrl).toContain('mode=presentation');

    await player.goto(`${baseURL}/?mode=player&room=${credentials!.roomCode}`);
    await player.getByLabel('Room code').fill(credentials!.roomCode);
    await player.getByLabel('Your name').fill('Score traveler');
    await player.getByRole('button', { name: 'Join Game' }).click();
    await expect(host.locator('.roster-row').getByText('Score traveler', { exact: true })).toBeVisible();

    await secondPlayer.goto(`${baseURL}/?mode=player&room=${credentials!.roomCode}`);
    await secondPlayer.getByLabel('Room code').fill(credentials!.roomCode);
    await secondPlayer.getByLabel('Your name').fill('Second traveler');
    await secondPlayer.getByRole('button', { name: 'Join Game' }).click();
    await expect(host.locator('.roster-row').getByText('Second traveler', { exact: true })).toBeVisible();

    await display.goto(credentials!.presentationUrl);
    await expect(display.locator('.presentation-room strong')).toHaveText(credentials!.roomCode);
    await host.getByRole('button', { name: 'Start Game' }).click();
    await expect(display.locator('.presentation-board')).toBeVisible();
    const normalBoard = host.locator('.showcase-board-stage > .board');
    const boardAt1440 = await normalBoard.boundingBox();
    expect(boardAt1440?.width).toBeGreaterThan(1200);
    await host.setViewportSize({ width: 1920, height: 1080 });
    const boardAt1920 = await normalBoard.boundingBox();
    expect(boardAt1920?.width).toBeGreaterThan(1700);
    expect(boardAt1920!.x + boardAt1920!.width).toBeLessThanOrEqual(1921);
    const displayCard = display.locator('.showcase-player-card').filter({ hasText: 'Score traveler' });
    const displayScore = displayCard.locator('[data-player-score]');
    const secondDisplayScore = display.locator('.showcase-player-card').filter({ hasText: 'Second traveler' }).locator('[data-player-score]');
    const hostScoreControls = host.locator('.score-controls-v2 > div').filter({ hasText: 'Score traveler' });
    await expect(displayScore).toHaveText('0');
    await expect(secondDisplayScore).toHaveText('0');

    await hostScoreControls.getByRole('button', { name: '+100' }).click();
    await expect(display.locator('.score-flight-token.correct')).toBeVisible();
    await expect(displayScore).toHaveClass(/score-impact-active.*score-impact-positive/);
    await expect(displayScore).toHaveText('100');
    await expect(secondDisplayScore).toHaveText('0');
    await expect(display.locator('.score-flight-token')).toHaveCount(0);

    await hostScoreControls.getByRole('button', { name: '-100' }).click();
    await expect(display.locator('.score-flight-token.wrong')).toBeVisible();
    await expect(displayScore).toHaveClass(/score-impact-active.*score-impact-negative/);
    await expect(displayScore).toHaveText('0');
    await expect(secondDisplayScore).toHaveText('0');
    await expect(display.locator('.score-flight-token')).toHaveCount(0);

    const firstPlayerId = await player.evaluate(() => JSON.parse(localStorage.getItem('blue-stage-player') ?? 'null')?.playerId as string | undefined);
    await player.reload();
    await expect(player.getByText(new RegExp(`ROOM ${credentials!.roomCode}`))).toBeVisible();
    await expect(host.locator(`.showcase-player-card[data-player-id="${firstPlayerId}"]`)).toHaveCount(1);
    expect(await player.evaluate(() => JSON.parse(localStorage.getItem('blue-stage-player') ?? 'null')?.playerId)).toBe(firstPlayerId);

    await Promise.all([playerContext.setOffline(true), secondPlayerContext.setOffline(true), displayContext.setOffline(true)]);
    await expect(display.getByText(/Display disconnected|link is no longer valid/)).toBeVisible();
    await Promise.all([playerContext.setOffline(false), secondPlayerContext.setOffline(false), displayContext.setOffline(false)]);
    await expect(display.locator('.presentation-board')).toBeVisible();
    await expect(displayScore).toHaveText('0');
    await expect(host.locator(`.showcase-player-card[data-player-id="${firstPlayerId}"]`)).toHaveCount(1);
    await expect(host.locator('.showcase-player-card').filter({ hasText: 'Second traveler' })).toHaveCount(1);
    await expect(host.locator('.showcase-player-strip')).toHaveAttribute('data-player-count', '2');

    await latePlayer.goto(`${baseURL}/?mode=player&room=${credentials!.roomCode}`);
    await latePlayer.getByLabel('Room code').fill(credentials!.roomCode);
    await latePlayer.getByLabel('Your name').fill('Late traveler');
    await latePlayer.getByRole('button', { name: 'Join Game' }).click();
    await expect(host.locator('.showcase-player-card').filter({ hasText: 'Late traveler' })).toBeVisible();
    await expect(host.locator('.showcase-player-strip')).toHaveAttribute('data-player-count', '3');

    await host.getByRole('button', { name: 'Join QR' }).click();
    await host.getByRole('button', { name: 'Rotate display link' }).click();
    await expect(host.getByRole('status', { name: '' }).filter({ hasText: 'New display link ready' })).toBeVisible();
    await expect(display.getByText(/Display disconnected|link is no longer valid/)).toBeVisible();
    const refreshed = await host.evaluate(() => JSON.parse(localStorage.getItem('blue-stage-host-room') ?? 'null') as { presentationUrl: string } | null);
    expect(refreshed?.presentationUrl).not.toBe(credentials!.presentationUrl);
  } finally {
    await latePlayerContext.close();
    await displayContext.close();
    await secondPlayerContext.close();
    await playerContext.close();
    await hostContext.close();
  }
});
