# Gameplay reference

## Players and room lifecycle

A room supports 0–5 player seats. Zero-player games can be used as practice/presentation mode. A joined phone receives a stable player ID and reconnect token. If a phone disconnects or leaves to the menu, the player is removed from the visible connected-player strip but the seat, score, statistics, and identity remain reserved. Returning from the same browser restores that seat when the host room still exists.

The host has two different player-management actions:

- **Pause seat** temporarily disconnects the controller while preserving the player, score, statistics, and reconnect token. The phone can reconnect to the same seat.
- **Remove** permanently deletes the player from the room and invalidates that reconnect seat. A returning phone must join as a new player.

The room stays open throughout the game. There is no host-facing lock-session control.

## Lobby

The host chooses exactly one question pack and the game rules, then starts the game. Players can join by room code or QR scan. The lobby QR itself is clickable and opens a larger scanning view. Audio begins when the host starts or continues a game. Master, music, and effects begin at 75% and remain adjustable.

## Game length

Game length changes the generated board, not only a label:

- **Quick:** 4 categories × 4 rows = 16 clues
- **Standard:** 5 categories × 5 rows = 25 clues
- **Marathon:** 6 categories × 6 rows = 36 clues, including the 1000-point row

The selected pack must contain enough complete categories for the chosen length.

## Board

The board is generated from the selected pack using complete categories and supported point values: 100, 200, 300, 400, 500, and 1000. Questions already used in recent generated boards are deprioritized where possible.

When late-game modifiers are enabled:

- 7+ questions remaining: 1x
- 4–6 questions remaining: 2x
- 1–3 questions remaining: 3x

The displayed board value reflects the active multiplier before selection. Used tiles show recorded player results when somebody answered. If a clue was revealed with no player response, the used tile shows a single centered completion checkmark.

Fullscreen presentation is an in-page board view. Questions remain selectable there. A Back button returns to the normal host layout.

## Normal spoken questions

1. Host selects a tile.
2. The question appears with the real point value in play.
3. Buzzers open automatically after the countdown or immediately through the host control.
4. The first accepted eligible buzz wins.
5. Host reveals the accepted answer.
6. Host marks the response Correct or Incorrect.
7. Score state is resolved by the engine.
8. On the host display, the awarded/lost number travels to the player score card, the visible score changes on impact, and the card performs a centered heartbeat pulse.
9. The game returns to the board when grading is complete.
10. The used tile records who answered and whether the result was correct or incorrect.

If the host reveals an answer before anybody buzzes, the answer now remains on screen. The host explicitly chooses **Continue to Board** instead of the game skipping the reveal.

The last board clue uses a staged tension overlay before the answer is revealed.

## Typed/free-response questions

Eligible phones type and lock answers. The answer reveals when all connected players submit or the timer closes responses. The host grades each submitted response. After the final unresolved response is graded, the game returns to the board automatically. If nobody submitted, the revealed answer stays visible until the host continues.

## Daily Double

Daily Doubles are assigned when a board is generated. The active controller/last-resolved player is used as the Daily Double player; the board no longer displays a separate Daily Double player selector.

Allowed wagers are fixed presets: 100, 200, 300, 400, 500, and 1000, subject to engine wager limits. The host and active player's phone show the same choices. Other phones can see the available choices while the wager is being selected.

After selection, the locked wager and total points in play are visible on the host question area and on all connected phones. If Daily Double multiplier stacking is enabled, the displayed points in play include the current late-game multiplier.

## Streaks

On Fire activates after three consecutive correct responses. Cold Streak activates at the configured consecutive-miss threshold. A correct response resets cold progress; an incorrect response resets positive streak progress. Streak states are reflected in the host player card and phone UI.

## Final Round

Final Round flow:

1. Final category reveal.
2. Host opens wagers.
3. Phones select one fixed wager: 0, 100, 200, 300, 400, 500, 1000, or All In.
4. All In displays the player's current positive score and is disabled when the score is zero or negative.
5. A locked wager is shown on that player's phone and host player/status card.
6. Host may start the Final question before every connected phone locks a wager; missing wagers become 0.
7. Players submit Final answers from their phones.
8. Submission completion or timer expiration does not expose the accepted answer. The host starts the reveal.
9. A staged tension sequence plays before the accepted answer appears.
10. Host reviews each player response and awards/rejects it.
11. When review ends, the staged podium animation plays, then the game transitions to readable per-player statistics.

Each phone also receives its own final score and statistics: correct, incorrect, accuracy, longest streak, fastest buzz, points gained/lost, and biggest wager.

## Rule tooltips

Every lobby rule control has a brief desktop hover/focus tooltip describing what the setting changes. Touch devices keep the setup uncluttered and do not render hover-only tooltip bubbles.

## Reset behavior

Reset Game preserves the room and reserved player seats but clears the current board, scores, streaks, statistics, Final state, timers, and host question history. Connected phones receive the new lobby snapshot immediately and should not require a page reload.

Reset Instance is the destructive recovery option. It clears saved Blue Stage host/player/game state and reloads the application cleanly.

## Phone input feedback

Phone buttons receive a short vibration through the browser Vibration API when supported. Browsers/devices that do not expose `navigator.vibrate` simply skip haptics without affecting the action.
