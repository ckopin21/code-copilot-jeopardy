# Gameplay reference

## Players and room lifecycle

A room supports 0–5 player seats. Zero-player games can be used as practice/presentation mode. A joined phone receives a stable player ID and reconnect token. If a phone disconnects or leaves to the menu, the player is removed from the visible connected-player strip but the seat, score, statistics, and identity remain reserved. Returning from the same browser restores that seat when the host room still exists.

The host has two different player-management actions:

- **Pause seat** temporarily disconnects the controller while preserving the player, score, statistics, and reconnect token. The phone can reconnect to the same seat.
- **Remove** permanently deletes the player from the room and invalidates that reconnect seat. A returning phone must join as a new player.

The room stays open throughout the game. There is no host-facing lock-session control.

When the host returns to the main menu from an active game, the room is paused rather than torn down. Connected phones remain connected to the same room and see the paused state. **Continue Saved Game** returns to that paused game. **Start New Game** reuses the same room, resets scores/board/stats/history, and preserves each player's seat, name, avatar, accent, buzzer sound, score effect, victory effect, reconnect token, and current connection state.

## Lobby

The host chooses a game mode, exactly one compatible question pack, and the game rules, then starts the game. Players can join by room code or QR scan. The lobby QR itself is clickable and opens a larger scanning view. Audio begins when the host starts or continues a game. Fresh instances start at Master 75%, Music 50%, and Effects 75%; all remain adjustable.

## Game modes

Blue Stage has two authoritative game modes:

- **Classic:** normal questions use first-buzz locking. The player on turn chooses the next question. Daily Doubles and keyboard/gamepad buzzers are available.
- **Free Response:** every player participating when the clue starts answers simultaneously by phone. The player on turn still chooses the next question, but there are no buzzers and Daily Doubles are disabled.

Free Response can add a configurable reading-only delay of 0, 3, 5, 7, 10, or 15 seconds before answer boxes open. A player joining after a question has already started watches that clue and becomes eligible on the next one.

Question-pack choices are filtered to packs that support the selected mode.

## Game length

Game length changes the generated board, not only a label:

- **Quick:** 4 categories × 4 rows = 16 clues; changing to Quick resets the default Daily Double count to 2
- **Standard:** 5 categories × 5 rows = 25 clues; changing to Standard resets the default Daily Double count to 4
- **Marathon:** 6 categories × 6 rows = 36 clues, including the 1000-point row; changing to Marathon resets the default Daily Double count to 6

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
8. On the host display, the awarded/lost number travels to the visible target player score card, the visible score changes on impact, and the card performs a centered positive/negative impact pulse. This applies in normal and in-page Presentation Mode; reduced-motion uses a brief non-moving highlight.
9. The game returns to the board when grading is complete.
10. The used tile records who answered and whether the result was correct or incorrect.

If the host reveals an answer before anybody buzzes, the answer now remains on screen. The host explicitly chooses **Continue to Board** instead of the game skipping the reveal.

The last board clue uses a staged tension overlay before the answer is revealed.

## Typed/free-response questions

For a typed question, the participant roster is captured for that clue. Eligible phones type and lock answers; late joiners spectate until the next question. In Free Response mode, an optional reading timer runs first, then answer entry opens.

Responses close when all currently active participants submit, when the answer timer expires, or when the host closes the response window. The accepted answer is then revealed. The host can review the suggested grading for each response and override it before confirming the results.

Every participant is scored when the host confirms: a correct response gains the clue value (plus any applicable comeback bonus), while an incorrect or missing response loses points subject to the negative-score rule. **Group Miss Mercy** applies when nobody is marked correct: each miss/no-response penalty becomes half the clue value, rounded to the nearest point. If at least one participant is correct, misses use the full clue value.

Confirmation is a single authoritative scoring step calculated from the same pre-confirmation room state, then the game returns to the board. This prevents one player's newly changed score from changing another player's comeback eligibility during the same clue.

## Daily Double

Daily Doubles are assigned when a board is generated. The active controller/last-resolved player is used as the Daily Double player; the board no longer displays a separate Daily Double player selector.

Allowed wagers are fixed presets: 100, 200, 300, 400, 500, and 1000, subject to engine wager limits. The host and active player's phone show the same choices. Other phones can see the available choices while the wager is being selected.

After selection, the locked wager and total points in play are visible on the host question area and on all connected phones. If Daily Double multiplier stacking is enabled, the displayed points in play include the current late-game multiplier.

Daily Double scoring is committed immediately by the authoritative game engine when the host judges the response. The score-flight animation is presentation-only and must not mask or delay the updated score, including when the Daily Double is the first scored clue of a fresh game.

## Streaks

On Fire activates after three consecutive correct responses. Cold Streak activates at the configured consecutive-miss threshold. A correct response resets cold progress; an incorrect response resets positive streak progress. Streak states are reflected in the host player card and phone UI.

## Final Round

Final Round flow:

1. Final category reveal.
2. Host opens wagers.
3. Phones select one fixed wager: 0, 100, 200, 300, 400, 500, 1000, or All In.
4. All In displays the player's current positive score and is disabled when the score is zero or negative.
5. A locked wager is shown on that player's phone and host player/status card.
6. Final wager safety rules can reduce the maximum: players at zero/negative score receive comeback protection with a maximum wager of 1000 and do not lose score on a miss; a sole runaway leader at least 2× the comparison threshold is capped at 1000. All In is only offered when the player's positive score is within the allowed maximum and no runaway cap applies.
7. Host may start the Final question before every connected phone locks a wager; missing wagers become 0.
8. Players submit Final answers from their phones.
9. Submission completion or timer expiration does not expose the accepted answer. The host starts the reveal.
10. A staged tension sequence plays before the accepted answer appears.
11. Host reviews each player response and awards/rejects it.
12. When review ends, the staged podium animation plays, then the game transitions to readable per-player statistics.

Each phone also receives its own final score and statistics: correct, incorrect, accuracy, longest streak, fastest buzz, points gained/lost, and biggest wager.

## Rule tooltips

Every lobby rule control has a brief desktop hover/focus tooltip describing what the setting changes. Touch devices keep the setup uncluttered and do not render hover-only tooltip bubbles.

## Reset behavior

New Game/Reset Game preserves the room, connected controllers, reserved seats, reconnect identities, and player customization, while clearing the current board, scores, streaks, statistics, Final state, timers, and host question history. Connected phones receive the new lobby snapshot immediately and do not need to rejoin.

After a completed game reaches recap, the host can choose **Start New Game** directly from the podium/statistics flow. This uses the same carryover behavior and returns the existing room to the lobby.

Reset Instance is the destructive recovery option. It clears saved Blue Stage host/player/game state and reloads the application cleanly.

## Player customization and phone feedback

Before joining, players can choose an avatar, accent color, buzzer sound, score-impact effect, and victory effect. Customization is stored with the authoritative player state so host, phone, presentation, score, and recap surfaces render the same identity. Current avatar choices are grouped into Animals, Robots, Fantasy, Space, Food, Monsters, Objects, Retro, Weird, and Abstract categories.

Phone buttons receive a short vibration through the browser Vibration API when supported. Browsers/devices that do not expose `navigator.vibrate` simply skip haptics without affecting the action.
