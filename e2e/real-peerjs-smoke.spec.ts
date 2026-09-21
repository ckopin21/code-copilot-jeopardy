import { expect, test } from '@playwright/test';

test('real PeerJS host and controller complete a rendered buzz-and-score recovery flow', async ({ browser, baseURL }) => {
  test.setTimeout(60_000);
  test.skip(process.env.BLUE_STAGE_REAL_PEERJS !== '1', 'Requires the public PeerJS signaling service.');

  const hostContext = await browser.newContext();
  const playerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const secondPlayerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const host = await hostContext.newPage();
  const player = await playerContext.newPage();
  const secondPlayer = await secondPlayerContext.newPage();
  try {
    await host.goto(`${baseURL}/?mode=host&fresh=1`);
    try {
      await expect(host.getByRole('button', { name: 'Start Game' })).toBeVisible({ timeout: 15_000 });
    } catch {
      test.skip(true, 'Public PeerJS signaling could not reserve a host room from this test environment.');
    }
    try {
      await expect(host.getByRole('status')).toHaveText('LIVE', { timeout: 15_000 });
    } catch {
      test.skip(true, 'Public PeerJS signaling is unavailable from this test environment.');
    }
    // PeerJS emits `open` before every public signaling path has observed the
    // fixed host id; give that registration one turn before connecting a phone.
    await host.waitForTimeout(750);
    const roomCode = (await host.locator('.join-card-v2 strong').textContent())?.trim();
    expect(roomCode).toMatch(/^[A-Z0-9]{5}$/);

    await player.goto(`${baseURL}/?mode=player&room=${roomCode}`);
    await player.getByLabel('Room code').fill(roomCode!);
    await player.getByLabel('Your name').fill('Browser player');
    await player.getByRole('button', { name: 'Join Game' }).click();
    await expect(player.getByRole('heading', { name: 'You’re in.' })).toBeVisible({ timeout: 15_000 });
    await expect(host.locator('.roster-row').getByText('Browser player', { exact: true })).toBeVisible({ timeout: 15_000 });

    await secondPlayer.goto(`${baseURL}/?mode=player&room=${roomCode}`);
    await secondPlayer.getByLabel('Room code').fill(roomCode!);
    await secondPlayer.getByLabel('Your name').fill('Second browser player');
    await secondPlayer.getByRole('button', { name: 'Join Game' }).click();
    await expect(secondPlayer.getByRole('heading', { name: 'You’re in.' })).toBeVisible({ timeout: 15_000 });
    await expect(host.locator('.roster-row').getByText('Second browser player', { exact: true })).toBeVisible({ timeout: 15_000 });

    await host.getByRole('button', { name: 'Start Game' }).click();
    const tile = host.locator('.question-tile:not(.used)').first();
    await expect(tile).toBeEnabled();
    await tile.click();
    await host.getByRole('button', { name: 'Open Buzzers Now' }).click();
    await expect(player.getByRole('button', { name: 'BUZZ' })).toBeEnabled({ timeout: 10_000 });
    await player.getByRole('button', { name: 'BUZZ' }).click();
    await expect(host.getByText('BUZZED IN')).toBeVisible({ timeout: 10_000 });

    await host.getByRole('button', { name: 'Reveal Answer' }).click();
    await host.getByRole('button', { name: 'Correct' }).click();
    await expect(host.locator('.showcase-player-card [data-player-score]')).toHaveText('100');
    await host.getByRole('button', { name: 'Continue to Board' }).click();

    await player.reload();
    await expect(player.getByText(new RegExp(`ROOM ${roomCode}`))).toBeVisible({ timeout: 15_000 });
    await expect(host.locator('.showcase-player-card [data-player-score]')).toHaveText('100');
    await expect(host.locator('.roster-row').filter({ hasText: 'Browser player' })).toHaveCount(1);
    await expect(host.locator('.roster-row').filter({ hasText: 'Second browser player' })).toHaveCount(1);

    // A previously disconnected controller must not strand the room: another
    // controller can still join the same host after the recovery incident.
    const latePlayerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const latePlayer = await latePlayerContext.newPage();
    try {
      await latePlayer.goto(`${baseURL}/?mode=player&room=${roomCode}`);
      await latePlayer.getByLabel('Room code').fill(roomCode!);
      await latePlayer.getByLabel('Your name').fill('Post recovery player');
      await latePlayer.getByRole('button', { name: 'Join Game' }).click();
      await expect(latePlayer.getByRole('heading', { name: 'You’re in.' })).toBeVisible({ timeout: 15_000 });
      await expect(host.locator('.roster-row').getByText('Post recovery player', { exact: true })).toBeVisible({ timeout: 15_000 });
    } finally {
      await latePlayerContext.close();
    }
  } finally {
    await secondPlayerContext.close();
    await playerContext.close();
    await hostContext.close();
  }
});
