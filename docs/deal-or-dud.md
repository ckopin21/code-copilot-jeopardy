# Deal or Dud

A four-player, same-room pitch game and the second game on the platform (`src/games/deal-or-dud/`, id `deal-or-dud`). One player pitches an absurd business; the other three are sharks. The presenter secretly knows whether the business is GOOD (an investor makes money) or BAD (an investor loses money). Everyone presents once in a four-round game.

Start it from the game picker at `/`, or go straight to `/?game=deal-or-dud&mode=host` on the TV laptop. Phones join by QR code, the join link, or the room key typed at `/`.

## Screens

| Screen | Where | Shows |
| --- | --- | --- |
| Host (TV) | `?game=deal-or-dud&mode=host` | Studio set, public facts, clock, offers, reveal, scores. Host controls, settings, and the soundtrack. |
| Presentation | Host's display link | The same TV view for a second screen. Sound is off unless "Play sound here" is tapped. |
| Every phone, at the start | `?mode=player` | Product builder and business name, then "Locked in" (the name can still change) until everyone is done. |
| Presenter phone | `?mode=player` | Secret verdict, six-card dossier (3 good, 3 bad), optional "Show on TV", partner choice. |
| Shark phone | `?mode=player` | Question ideas, the facts on the TV, bid and lock. |
| First player's phone | same | Adds a 🎛 button in the header: pause/resume, lock everyone in, skip the pitch, questions and waits, volumes. |

The TV never receives the verdict, hidden cards, bids before everyone locks, or seat codes. That boundary is `engine/sanitize.ts` and is covered by `tests/deal-or-dud/engine.test.ts`.

## Game flow (all enforced in `engine/DealEngine.ts`)

**Build, once, before round 1** (default 45s). Everyone builds their own product on their phone at the same time. Each phone sees only its own; the TV shows who has locked in. The last lock starts round 1; when the clock runs out (or the host taps "Lock everyone in"), open products lock as they are and a missing product is supplied. The four products wait in `upcoming` (in join order, which is the pitch order) until their round. Nobody sees their GOOD/BAD file until their own pitch starts.

Then four rounds, each opening straight into its pitch:

1. **Pitch** (one clock, default 90s). The three good facts go on the TV at once. The presenter reads their secret file (GOOD or BAD, plus three hidden bad facts) and pitches on the same clock. The presenter ("Done pitching") or the host (Skip) can end it early.
2. **Questions** (150s). Fact checks are verbal: if a shark asks about something a hidden bad fact covers, the presenter must say it. The presenter may also tap "Show on TV" to put a card on the board; nothing else appears on its own. Questions end when the clock runs out, when all three sharks tap "I'm ready to bid" (a second tap takes it back), or when the host skips.
3. **Bids** (45s). Each shark picks $0 to $500K in $100K steps and locks it with one tap (final). A bid that isn't locked counts as $0.
4. **Partner** (20s). Only when sharks tie at the top bid; the presenter chooses, and a timeout picks at random.
5. **The truth** (15s): verdict, all six facts, explanation, a "what happened later" line, points. Then a 12s scores break (skippable).

After four rounds a tie at the top goes to the **Final Forecast** tiebreaker: tied players guess a number privately; closest wins; one repeat with a new card; then a random draw.

Scoring lives in `engine/scoring.ts`. Points scale with the deal: one per $100K (U = 1 to 5).

| Outcome | Presenter | Winning shark | Sharks who bid $0 | Outbid sharks |
| --- | --- | --- | --- | --- |
| GOOD, deal of U × $100K | U + 2 | U + 2 | 0 | 0 |
| BAD, deal of U × $100K | U | −U | +1 each | 0 |
| GOOD, no deal | +1 | none | 0 each | none |
| BAD, no deal | −2 | none | +1 each | none |

A $500K deal on a GOOD business gives the presenter and the shark 7 each.

## Phone layout

Every phone screen fits the viewport without page scrolling: a header (name, score, room key and seat code, clock), the screen's content, and its main button at the bottom of the column. Long lists are paged or tabbed instead of scrolled: the builder shows 12 options at a time ("More options"), the presenter's cards and pitch ideas sit behind tabs, and the shark's facts and question ideas share a tab bar. On a very small screen the content area can still scroll as a fallback.

## Pause and disconnects

- The Host or the first player can pause at any time. Every deadline shifts by the paused time.
- If the presenter's phone drops mid-round, the round pauses by itself and resumes when it reconnects. A phone dropping during the build doesn't pause; its product locks with the others.
- Rooms saved mid-game by a version from before the shared build go back to their lobby on load (their later rounds were never built).
- A server restart restores rooms paused.
- The game needs exactly four players. Removing a player mid-game returns the room to the lobby. In the lobby, the Host screen shows a Remove button (with a confirm) next to any offline player, so an abandoned seat never blocks the start.
- **Seat codes.** Every player gets a 4-digit seat code, shown under their name on their phone with the room key. Entering the room key and seat code on any phone ("Already playing? Get your seat back") takes the seat back and signs the old phone out. Ten wrong codes in a minute pause further tries. Only the owner's phone ever receives its code.
- A phone that reopens the join link or types the room key at `/` returns to its saved seat automatically. It forgets the seat only if the server says the seat or room is gone, not on a network error.
- The Back button on a seated phone asks "Leave the game?" first. Leaving keeps the seat.
- A room key typed into the trivia join screen that belongs to another game opens that game instead, and the trivia menu has an "All games" button back to the picker.
- One browser tab keeps one connection across games, so joining or reconnecting to a seat replaces any seat that tab held in another game instead of being refused.
- Settings are locked once a game starts, except audio and captions.

## Content (`src/games/deal-or-dud/content/`)

- `words.ts`: 56 modifiers, 104 products, 50 audiences (45, 93 and 40 of them Clean). Each has a tone, and modifiers list the product forms they fit (food, gadget, goods, pet, service, rental, digital, event). The builder disables picks that would make a broken headline.
- `profilesGood.ts` / `profilesBad.ts`: 23 GOOD and 23 BAD business families with 92 complete six-card variants, at least two per family (3 favorable, 3 unfavorable, distinct subjects). Every card has Simple / Standard / Challenge wording.
- `cues.ts`: pitch cues, shark question ideas, "later" jokes, business-name patterns, avatar presets, tiebreaker cards.
- The verdict is a fair coin flip, independent of the words, with no per-game quota. Dossiers and headlines never repeat within a game, and recently used dossiers are deprioritized across games on the same server.

`tests/deal-or-dud/content.test.ts` enforces the content rules:
- at most one number per card, no business jargon, cards short enough to read at a glance
- subjects fit the product form, and every product form has at least 6 GOOD and 6 BAD variants
- Clean pools contain no crude, gross or creepy words
- every tone has enough material for four rounds

Run it after any content edit:

```bash
npx vitest run tests/deal-or-dud
```

The tests can't check whether a high schooler can explain the outcome in one sentence. Read new profiles aloud with their `explain` line before shipping them.

## Audio (`public/deal-or-dud/audio/`)

- **Music and stings** are synthesized by `scripts/deal-or-dud/render-music.ts` (no samples). Loops are WAV so they loop without gaps; stings are MP3.
  - Loops: lobby, discussion bed, offer pulse.
  - Stings: fanfare, pitch intro, GOOD/BAD reveals, winner.
- **Sound effects** `lock.mp3` (poker chips), `card.mp3` (card placed) and `tick.mp3` come from Kenney's CC0 packs (kenney.nl: Casino Audio, Interface Sounds). The tick counts down the last 5 seconds of the build, bid, partner and tiebreaker clocks.
- Only the Host tab plays sound by default. Music ducks under narration. The discussion bed plays at a low level; the offer pulse is only slightly louder. Card stings are soft.

### The hosts (narration)

Two host voices, `adam` and `george`, take turns. They are cloned by Chatterbox (MIT, runs on the PC's GPU) from reference clips made with Kokoro-82M.

- **Fixed lines** (phase calls, time warnings, verdicts) are in `src/games/deal-or-dud/audio/narrationLines.ts` and recorded to `voice/<line>-<variant>-<voice>.mp3`. The tutorial script is `tutorialScript.ts`; its clips are `tut-*.mp3`, and `narrationDurations.ts` is generated with them.
- **Live lines** say player and business names ("Ava is in the building!", "Round two! Please welcome Ben, founder of …", "Ben just struck gold!"). The TV asks `/api/deal-or-dud/voice`, which forwards to the narrator service on the same computer (`DEAL_VOICE_URL`, default `http://127.0.0.1:5123`).
- **Rendered ahead** by the server (`voicePrep.ts`, from `onStateChange`): each player's name lines while the lobby fills, and every pitch intro as soon as its product locks during the build. Only the narrator's cache is filled, so a product stays secret until its pitch. This is what keeps a slower computer (a MacBook Air) on time: by round 2 the intros play instantly.
- **Without the narrator service** (or if a line takes over 4 seconds) the TV plays a fixed fallback line instead ("Our next entrepreneur is in the hot seat!"), so the game never waits on it.
- **What is said when** is decided in `audio/narrationPlan.ts` (pure, tested in `tests/deal-or-dud/narration.test.ts`) and played by `audio/narrator.ts`, one line at a time. A new phase cuts off the previous line. Warnings play at 30 s (on clocks of 55 s or more) and 10 s, and are dropped if they cannot start within 2.5 s.
- **Names** are spoken with emoji and symbols removed. The host can set a pronunciation in the lobby list (🗣 → type it how it sounds → ▶ to hear it); it is stored on the player as `sayAs`. Product names are only spoken once the pitch makes them public.
- **Captions** show the current line on the screen that plays the sound when Captions is on.

**The narrator service** is `scripts/deal-or-dud/voice/voice_server.py` with the two reference voices in `refs/`. It caches every line, re-rolls takes whose length doesn't fit the text, and only listens on its own computer. It uses an NVIDIA GPU, Apple silicon (MPS), or the CPU (slow).

- **Setup, once per computer:** install uv (Windows `winget install astral-sh.uv`, Mac `brew install uv`), then `npm run voice:setup`. That puts Python 3.11, Chatterbox and PyTorch in `~/.blue-stage/narrator/venv` (a few GB, outside the repo). The voice model (about 3 GB) downloads the first time the narrator starts, into the Hugging Face cache.
- **Starts with the game:** `npm run serve` and the START launchers start it through the platform's `startServices` hook (`voiceService.ts`) and stop it on exit. It takes about 10–30 seconds to load; lines asked for before then use the recorded fallbacks. If one is already running on the port, it is reused. Tests and `BLUE_STAGE_SERVICES=0` skip it.
- **Undo:** delete `~/.blue-stage/narrator` (and the Hugging Face cache folder for `ResembleAI/chatterbox`).

To regenerate (ffmpeg on the Windows PC: `C:\Users\caleb\Downloads\ffmpeg-8.0-full_build\ffmpeg-8.0-full_build\bin\ffmpeg.exe`; ffprobe must sit next to it):

```bash
FFMPEG=<path to ffmpeg.exe> npx tsx scripts/deal-or-dud/render-music.ts
```

With the narrator service running (`--only=tutorial|lines|suspect` does one part, `suspect` being clips whose length doesn't fit their text; `--match=<regex>` limits to matching output paths):

```bash
FFMPEG=<path to ffmpeg.exe> npx tsx scripts/deal-or-dud/render-narration.ts
```

## Selfies

"Take a photo" is a file input with `capture="user"`, so a tap opens the phone's own camera app. This works over the plain-HTTP LAN; an in-page live camera would need HTTPS. The phone then crops the photo to 192px. Photos live only in the room's saved state and expire with the room (12 hours idle). If the camera is refused or missing, the preset characters still work.

## Things to check on real devices

See `docs/real-device-test-matrix.md` for the general procedure. Game-specific checks:
- **Selfies**: on iPhone Safari and Android Chrome, "Take a photo" opens the front camera, crop and retake work, and denying the camera still lets you pick a preset.
- **Sound**: the soundtrack starts after "Settings & start", the discussion bed stays quiet enough to talk over, and narration is intelligible from across the room.
- **Screen lock**: lock the presenter's phone mid-round. The TV should show "Paused — waiting for the presenter's phone", then resume on unlock.
- **Readability**: the TV headline, cards and clock are readable from the couch.
