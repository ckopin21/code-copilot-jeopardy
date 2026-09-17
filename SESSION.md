# Session Handoff — New Jeopardy

## Start here
Continue the existing work immediately. Do **not** ask the user to restate the request and do **not** restart from `main`.

Repository: `ckopin21/code-copilot-jeopardy`

Active work branch: `fix/menu-comeback-layout-polish`

Base branch: `main`

The feature branch is already ahead of `main` with the in-progress fixes from the user's latest request. Preserve that work, inspect the current branch diff, finish anything still incomplete, validate it, then use the normal PR → CI → merge → GitHub Pages verification workflow.

## User's previous prompt to continue
> I need to be able to adjust music in the menu, and I should be able to change the daily double value too in the start menu. Also when adjusting audio in the game, any click outside of the box should close the menu. Comeback boost is currently covering the board on the host device, it should not do that. In the question it also covers the player names, but also the english is off, it should be "gets it right". And the 2x boost should be for every question, not a dynamic 3x for 100 and 200 questions. If I got that wrong, the cap for max bonus points should not be 100, it just should be 3x or 2x whatever the value is of the base question. Other modifiers do stack. And the adjusting points manually button outside of presentation mode slightly clips into the questions board. And On turn covers the on fire/cold streak pill.

The user then added:

> Also later in the game, some of the UI elements are no centered anymore on the board.

The screenshot showed a late-game board where the board itself remained present but visual elements around/inside it were no longer visually centered, especially with answered-result overlays, modifier badges, the late-game 3× state, and the manual score controls visible below the board.

## Intended behavior

### Main-menu audio
- The main menu must allow **music volume adjustment**, not only track selection and mute/unmute.
- Preserve the quieter music-volume policy already implemented earlier.
- Tatamusic remains the default for users without a saved preference.
- Participant phones remain effects-only; do not re-enable music on phones.

### Daily Double setup
- The host must be able to change the Daily Double setting from the lobby/start setup instead of the enhancement layer forcing the automatic 2/4/6 value back on every room-state update.
- Existing game-length defaults can remain useful defaults, but the host's manual selection must stick.
- Verify the UI wording is unambiguous (the current underlying setting is `dailyDoubleCount`).

### In-game Audio drawer
- Clicking outside an open Audio drawer should close it.
- Clicking/interacting inside the drawer must not close it.
- Existing close button continues to work.

### Comeback boost rules
Already-required baseline rules remain:
- Only the **sole** last-place player can qualify.
- A tie for last gets no boost.
- Comebacks remain disabled until **every active player has completed at least two turns**.
- Only the eligible turn owner gets the comeback multiplier.
- Wrong/no answer loses only the normal effective clue value.
- Another player buzzing on that turn scores normal points and does not spend the eligible player's boost.
- Two successful 2× uses and one successful 3× use per player/game.
- Daily Doubles and Final do not use comeback boosts.

Latest clarification:
- The active comeback tier must be stable for the player's whole turn; it must **not change just because they picked a 100/200/300/etc clue**.
- Once 2× is active, every ordinary clue on that turn gets a 2× comeback award if the eligible player is correct.
- Once 3× is active, every ordinary clue gets 3× if correct.
- The comeback multiplier applies to the question's **effective/base scoring value with existing modifiers already applied**, so modifiers stack. Example: a late-game 2× clue worth 400 effective points with a 2× comeback should award 800, not be capped at a fixed bonus.
- No fixed +100-style bonus cap.
- Current branch implementation uses a stable board reference (`comebackReferenceValue`) for qualification and multiplies the effective clue value for the actual award. Verify this matches the user's intent across Quick/Standard/Marathon boards and existing tests.

### Comeback UI
- On the host board, the comeback notice must **not cover the board**.
- During a question, it must **not cover player cards/names**.
- Wording must say **"gets it right"** for a named player.
- The notice should be concise enough not to become a layout obstruction.

### Host board spacing / centering
- Manual `-100/+100` score controls must not clip into or visually touch the board.
- Late-game modifier banners and answered-result content must not make the board look shifted/off-center.
- Keep the board centered within its stage at all times, including final-six/final-three multiplier states and with score controls present.
- Result overlays, modifier badges, category headers, and clue values should remain centered inside their own cells.

### Player-card status overlap
- `ON TURN` must not overlap the `ON FIRE` or `COLD STREAK` pill.
- The screenshot showed both in the top-right area of the same player card. Give each status its own non-overlapping space while preserving readable player name and score.

## Work already present on the feature branch
At the time this handoff was written, the branch had changes in these areas:
- `src/components/AudioMixer.tsx`
- `src/components/BackgroundMusicPicker.tsx`
- `src/components/ComebackBoostNotice.tsx`
- `src/components/HostEnhancements.tsx`
- `src/game-ui-polish-v2.css` (new)
- `src/lib/comebackScoring.ts`
- `src/lib/devModeScenario.ts`
- `src/lib/lobbySetupEnhancements.ts`
- `src/main.tsx`
- `tests/comebackBoostPersistence.test.ts`
- `tests/comebackScoring.test.ts`
- `tests/devModeScenario.test.ts`

Notable implemented direction already on the branch:
- Comeback qualification was changed from clue-dependent thresholds to a stable board-reference threshold via `comebackReferenceValue`.
- Actual awarded points remain `effective clue value × comeback multiplier`, allowing late-game modifiers to stack.
- Comeback notice wording/structure was simplified and includes "gets it right".
- Dev-mode scoring was adjusted so changing inspected clue value does not incorrectly change comeback tier.
- Lobby enhancement logic was modified so Daily Double configuration can be manually controlled rather than constantly forced by game length.
- Audio/menu and layout-polish files have in-progress changes.

Do not assume the UI is finished merely because these files changed. The latest user specifically reported late-game centering problems after the earlier changes, so visually verify the branch state.

## What to do next
1. Read the current diff from `main` to `fix/menu-comeback-layout-polish` before editing.
2. Finish/verify every item above, with special attention to late-game board centering and the ON TURN/streak collision.
3. Use Dev Mode / Presentation Lab where useful to reproduce 2–5 player states, late multipliers, streaks, comeback boosts, answered tiles, and manual score controls.
4. Add/update regression tests for scoring behavior and any source-level UI invariants that are testable.
5. Run typecheck, lint, tests, and production build.
6. Create a PR only when validation is clean.
7. Merge only after CI passes.
8. Verify the GitHub Pages deploy succeeds before telling the user it is live.

## Do not regress
- Participant phones: sound effects work, background music does not.
- Host/presentation music still works, with the reduced music gain policy.
- Tatamusic default track.
- Main-menu music mute/unmute behavior and saved track preferences.
- Dev Mode and full-screen Presentation Lab.
- Presentation score-impact single pulse.
- Answered tiles show centered value, player/result, and scoring modifiers.
- Only sole last place qualifies for comeback; tie for last does not.
- Comebacks wait until every active player completes two turns.
- Undo restores comeback-use state because uses are derived from authoritative board history.
- Existing fullscreen, reconnect, and multiplayer stability fixes.

## User preference for execution
Keep user-facing replies short. Make the changes rather than giving instructions. Use small GitHub commits, PR/CI, merge, and deployment verification. If something expected to work fails, retry once before reporting the blocker.