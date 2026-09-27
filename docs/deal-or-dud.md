# Deal or Dud

A four-player, same-room pitch game and the second game on the platform (`src/games/deal-or-dud/`, id `deal-or-dud`). One player pitches an absurd business; the other three are sharks. The presenter secretly knows whether the business is GOOD (an investor makes money) or BAD (an investor loses money). Everyone presents once in a four-round game.

Start it from the game picker at `/`, or go straight to `/?game=deal-or-dud&mode=host` on the TV laptop. Phones join by QR code, the join link, or the room key typed at `/`.

## Screens

| Screen | Where | Shows |
| --- | --- | --- |
| Host (TV) | `?game=deal-or-dud&mode=host` | Studio set, the four scorecard tiles (who peeked at what; the answers only at the reveal), clock, offers, reveal, scores. Host controls, settings, and the soundtrack. |
| Presentation | Host's display link | The same TV view for a second screen, including the lobby's join card (QR code, room key, link, who is in). Plays sound by default, like the Host tab. |
| Every phone, at the start | `?mode=player` | Three quick card picks (product, twist, audience) and the business name, then "Locked in" (the name can still change) until everyone is done. |
| Presenter phone | `?mode=player` | Secret verdict and the full scorecard (✅/❌ and a line for each check, plus who peeked where), a pitch idea, partner choice. |
| Shark phone | `?mode=player` | The one peek (tap a check, tap again), its answer, things to ask, "I'm ready to bid", then bid and lock. |
| First player's phone | same | Adds a 🎛 button in the header: pause/resume, lock everyone in, skip to bids, skip the waits, volumes. |

Before the reveal, the TV never receives the verdict or any scorecard row, a shark's phone receives only the row it peeked at, and nobody sees bids before everyone locks or anyone else's seat code. Who peeked at which check is public. That boundary is `engine/sanitize.ts` and is covered by `tests/deal-or-dud/engine.test.ts`.

## Game flow (all enforced in `engine/DealEngine.ts`)

**Build, once, before round 1** (default 1:15). Everyone builds their own product on their phone at the same time with three quick card picks: 1 of 4 **products**, then 1 of 4 **twists** (only ones that fit the product), then 1 of 4 **audiences** ("Pirate-themed toasters for grandmas"). Each step has 🔀 New cards and Back, and tapping a pick at the top changes it. After the picks come the business-name chips and "Lock it in". The server deals the hands so no two players hold the same product. Each phone sees only its own; the TV shows who has locked in. The last lock starts round 1; when the clock runs out (or the host taps "Lock everyone in"), open products lock as they are and any empty pick gets a random card from its hand. The four products wait in `upcoming` (in join order, which is the pitch order) until their round. Nobody sees their scorecard until their own round starts.

**The scorecard.** When a product locks, the verdict is a fair coin. Four fixed checks, the same every round, each come back ✅ or ❌ with one short line:

| Check | Tile | ✅ means |
| --- | --- | --- |
| `works` 🔧 | Does it work? | Yes |
| `demand` 🙋 | Do people want it? | Yes |
| `money` 💰 | Does it make money? | Yes |
| `trouble` 🚨 | Any trouble? (safety, lawsuits, bad reviews) | All clear (no trouble) |

A GOOD business gets 3 ✅ (70%) or 4 (30%). A BAD one gets 2 (50%), 1 (35%) or 0 (15%), so it still has real strengths to sell. Which checks pass is random.

Then four rounds, each opening straight on stage:

1. **On stage** (one clock, default 3:00, 1:00 to 10:00 in settings). The presenter's phone shows the verdict and all four rows; they pitch and talk around the ❌s while the sharks ask anything. **Each shark gets one peek per round**: tap a check (then tap again to confirm) and only that phone shows its ✅/❌ and line. Sharks can share it, keep it, or bluff. The TV shows who peeked at what, never the answer. The stage ends when the clock runs out, when all three sharks tap "I'm ready to bid" (a second tap takes it back), or when the host skips.
2. **Bids** (45s). Each shark picks $0 to $500K in $100K steps and locks it with one tap (final). A bid that isn't locked counts as $0.
3. **Partner** (20s). Only when sharks tie at the top bid; the presenter chooses, and a timeout picks at random.
4. **The truth** (10s): the four tiles flip to ✅/❌ with their lines, the verdict, a one-sentence explanation, a "what happened later" line, points. Then a 5s scores break. Both are skippable.

Timer presets: Quick (build 0:55, stage 2:00), Standard (1:15, 3:00), Relaxed (1:40, 4:00).

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

Every phone screen fits the viewport without page scrolling: a header (name, score, room key and seat code, clock), the screen's content, and its main button at the bottom of the column. The builder shows one step of four big cards at a time, the presenter's scorecard is four short rows, and the shark's peek is a 2×2 grid with two talking points under it. On a very small screen the content area can still scroll as a fallback. The e2e test checks both at 390×844.

## Pause and disconnects

- The Host or the first player can pause at any time. Every deadline shifts by the paused time.
- If the presenter's phone drops mid-round, the round pauses by itself and resumes when it reconnects. A phone dropping during the build doesn't pause; its product locks with the others.
- Rooms saved mid-game by an older version (before the shared build, or with the fact-card dossier and separate pitch and question clocks) go back to their lobby on load with their players. Old timer settings move to the stage clock: a named preset takes the new preset values; custom timers keep the build, offer and tiebreaker values and get the standard 3:00 stage.
- A server restart restores rooms paused.
- The game needs exactly four players. Removing a player mid-game returns the room to the lobby. In the lobby, the Host screen shows a Remove button (with a confirm) next to any offline player, so an abandoned seat never blocks the start.
- **Seat codes.** Every player gets a 4-digit seat code, shown under their name on their phone with the room key. Entering the room key and seat code on any phone ("Already playing? Get your seat back") takes the seat back and signs the old phone out. Ten wrong codes in a minute pause further tries. Only the owner's phone ever receives its code.
- A phone that reopens the join link or types the room key at `/` returns to its saved seat automatically. It forgets the seat only if the server says the seat or room is gone, not on a network error.
- **Leaving.** The Leave button in the phone header (or the Back button) asks "Leave the game?": **Leave for now** keeps the seat for coming back with the seat code; **Leave for good** (`player:leave`) frees the seat, passes host controls to the next player, and mid-game sends everyone back to the lobby (the game needs four).
- A room key typed into the trivia join screen that belongs to another game opens that game instead, and the trivia menu has an "All games" button back to the picker.
- One browser tab keeps one connection across games, so joining or reconnecting to a seat replaces any seat that tab held in another game instead of being refused.
- Settings are locked once a game starts, except audio and captions.

## Content (`src/games/deal-or-dud/content/`)

- `words.ts`: the builder cards, each with an emoji and a tone: 84 products, 50 twists, 51 audiences (71, 38 and 40 of them Clean). Twists list the product forms they fit (food, gadget, goods, pet, service, rental, digital, event), and a twist hand only deals ones that fit the picked product, so headlines never break.
- `scorecard.ts`: the four checks and the line pools, one pool per check and result (✅/❌). Lines can name the product and its customers, carry `forms` when they only suit some products (no crashing apps for cupcakes), and carry a tone. Also the shark talking points per check.
- `dealer.ts`: hands, headlines, names, and `dealScorecard` (which checks pass, and a fresh line for each).
- `cues.ts`: pitch ideas, "later" jokes, business-name patterns, avatar presets, tiebreaker cards.
- Products, headlines and scorecard lines never repeat within a game, and recently used lines are deprioritized across games on the same server.

`tests/deal-or-dud/content.test.ts` enforces the content rules:
- every line fits a tile (48 characters), has at most one number and no business jargon
- every check, result and product form has at least 3 lines in every tone
- every product has at least 8 twists that fit it, in every tone
- Clean pools contain no crude, gross or creepy words
- every tone has enough material for four rounds

Run it after any content edit:

```bash
npx vitest run tests/deal-or-dud
```

The tests can't check whether a line reads naturally with every product it fits. Read new lines aloud with a couple of products of each form before shipping them.

## Audio (`public/deal-or-dud/audio/`)

- **Music and stings** are Pixabay tracks the user picked (Pixabay Content License, no attribution required; `CREDITS.md` in the audio folder lists each track, artist and page). The untouched downloads are on the Windows PC in `C:\Users\caleb\code\tools\deal-or-dud-audio-backup\pixabay\`, and `C:\Users\caleb\code\tools\deal-or-dud-music\integrate_pixabay.sh` turns them into the game files (its `README.md` explains how the loop points were found). Everything is loudness-matched: loops −16 LUFS, stings −14 to −15.
  - **Loops** (MP3, 192 kbps): lobby (`lobby-loop.mp3`, 118 s), build and stage bed (`discussion-bed.mp3`, 76 s), bids (`offer-pulse.mp3`, 21.6 s), and the after-winner loop (`winner-loop.mp3`, 45 s). Each loop is a whole number of bars cut where the music matches itself, with a short crossfade. MP3 blurs the first and last milliseconds of a file, so each file carries half a second of wrapped audio on both ends, and `dealAudio.ts` loops between `loopStart` and `loopEnd` (the exact loop lengths are in `MUSIC_FILES`). Re-rendering a loop means updating its sample count there.
  - **Stings:** fanfare (the first 4 bars of Breaking News, game start and final scores), pitch intro (2 bars of the Breaking News logo, each round going on stage), GOOD/BAD reveals, winner.
  - **Game over:** music stays off while the winner sting plays, then the after-winner loop starts (timed from the sting's real length) and runs until the host plays again (back to the lobby loop) or closes the screen. A screen opened on a finished game starts the loop at once.
  - Earlier sets are backed up in `tools\deal-or-dud-audio-backup\`: `music-v1\` (synthesized; its generator `scripts/deal-or-dud/render-music.ts` was removed and is in git history) and `music-v2-acestep\` (ACE-Step drafts, made by `tools\ace-step\`).
- **Sound effects** `lock.mp3` (poker chips), `card.mp3` (card placed) and `tick.mp3` come from Kenney's CC0 packs (kenney.nl: Casino Audio, Interface Sounds). The tick counts down the last 5 seconds of the build, bid, partner and tiebreaker clocks.
- Sound is on by default on the Host tab and the Presentation screen (phones never play music). Each screen tries to start sound as it opens; browsers that block that start it at the first click, tap or key press anywhere on the page (`audio/useAutoSound.ts`), and "Play sound here" shows until then. If the Host tab and a Presentation screen are both open in the same room, untick "Play sound on this screen" in the host settings so the room hears one soundtrack. Music ducks under narration, and so do the long stings (fanfare, pitch intro, winner), by about 6 dB, because the hosts talk over them. The stage bed plays at a low level; the offer pulse is only slightly louder. A peek plays a soft card flip.

### The hosts (narration)

Two host voices, `adam` and `george`, take turns. They are cloned by Chatterbox (MIT, runs on the PC's GPU) from reference clips made with Kokoro-82M.

- **Fixed lines** (phase calls, time warnings, verdicts) are in `src/games/deal-or-dud/audio/narrationLines.ts` and recorded to `voice/<line>-<variant>-<voice>.mp3`. The tutorial script is `tutorialScript.ts`; its clips are `tut-*.mp3`, and `narrationDurations.ts` is generated with them.
- **Live lines** say player and business names (a lobby greeting such as "Ava is in the building!" or "Make some noise for Ava!", "Round two! Please welcome Ben, founder of …", "Ben just struck gold!"). The lobby has eight greetings (`JOIN_GREETINGS`); each seat gets a different one, starting at a point set by the room key, and the two voices alternate. Each round opens with the round call, the founder intro, then "Sharks, you each get one peek." The TV asks `/api/deal-or-dud/voice`, which forwards to the narrator service on the same computer (`DEAL_VOICE_URL`, default `http://127.0.0.1:5123`).
- **Rendered ahead** by the server (`voicePrep.ts`, from `onStateChange`): each player's name lines while the lobby fills, and every pitch intro as soon as its product locks during the build. Only the narrator's cache is filled, so a product stays secret until its pitch. This is what keeps a slower computer (a MacBook Air) on time: by round 2 the intros play instantly.
- **Without the narrator service** (or if a line takes over 4 seconds) the TV plays a fixed fallback line instead ("Our next entrepreneur is in the hot seat!"), so the game never waits on it.
- **What is said when** is decided in `audio/narrationPlan.ts` (pure, tested in `tests/deal-or-dud/narration.test.ts`) and played by `audio/narrator.ts`, one line at a time. A new phase cuts off the previous line. Stage warnings play at 60 s (on clocks of 2:00 or more), 30 s (55 s or more) and 10 s, and are dropped if they cannot start within 2.5 s.
- **The tutorial** (`tutorialScript.ts`, 7 steps, about 45 s): the shared build, going on stage, the four checks, one peek each, bids, the truth. The TV shows a demo for each step (`TutorialDemo` in `ui/TvStage.tsx`).
- **Names** are spoken with emoji and symbols removed. The host can set a pronunciation in the lobby list (🗣 → type it how it sounds → ▶ to hear it); it is stored on the player as `sayAs`. Product names are only spoken once their round makes them public.
- **Captions** show the current line on the screen that plays the sound when Captions is on.

**The narrator service** is `scripts/deal-or-dud/voice/voice_server.py` with the two reference voices in `refs/`. It caches every line, re-rolls takes whose length doesn't fit the text, and only listens on its own computer. It uses an NVIDIA GPU, Apple silicon (MPS), or the CPU (slow).

- **Setup, once per computer:** install uv (Windows `winget install astral-sh.uv`, Mac `brew install uv`), then `npm run voice:setup`. That puts Python 3.11, Chatterbox and PyTorch in `~/.blue-stage/narrator/venv` (a few GB, outside the repo). The voice model (about 3 GB) downloads the first time the narrator starts, into the Hugging Face cache.
- **Starts with the game:** `npm run serve` and the START launchers start it through the platform's `startServices` hook (`voiceService.ts`) and stop it on exit. It takes about 10–30 seconds to load; lines asked for before then use the recorded fallbacks. If one is already running on the port, it is reused. Tests and `BLUE_STAGE_SERVICES=0` skip it.
- **Undo:** delete `~/.blue-stage/narrator` (and the Hugging Face cache folder for `ResembleAI/chatterbox`).

To regenerate (ffmpeg on the Windows PC: `C:\Users\caleb\Downloads\ffmpeg-8.0-full_build\ffmpeg-8.0-full_build\bin\ffmpeg.exe`; ffprobe must sit next to it):

With the narrator service running (`--only=tutorial|lines|suspect` does one part, `suspect` being clips whose length doesn't fit their text; `--match=<regex>` limits to matching output paths):

```bash
FFMPEG=<path to ffmpeg.exe> npx tsx scripts/deal-or-dud/render-narration.ts
```

## Art and motion

- **3D emoji art.** Avatars, props, builder cards and the scorecard icons draw as Microsoft Fluent Emoji 3D images (MIT; the notice is `public/deal-or-dud/art/LICENSE-fluent-emoji.txt`). `scripts/deal-or-dud/copy-art.ts` copies the image for every emoji in the content pools from the full set (`C:\Users\caleb\code\tools\fluent-emoji\assets\`, or `FLUENT_EMOJI=<folder>`) into `public/deal-or-dud/art/<code points>.png` at 128px, and writes `src/games/deal-or-dud/artManifest.ts`. `ui/Emoji.tsx` draws the image when one exists and the text emoji otherwise, so a new word with a new emoji still works; re-run the script (with `FFMPEG=<path>`) to give it art.
- **Motion** is CSS only: builder cards deal in, scorecard tiles flip over one after another at the reveal, the GOOD/BAD stamp slams down, points rows and standings slide in, scores count up on the nameplates (`ui/CountUp.tsx`), and banners and headlines slide in on each phase. Everything switches off under the system's reduce-motion setting.

## Selfies

"Take a photo" is a file input with `capture="user"`, so a tap opens the phone's own camera app. This works over the plain-HTTP LAN; an in-page live camera would need HTTPS. The phone then crops the photo to 192px. Photos live only in the room's saved state and expire with the room (12 hours idle). If the camera is refused or missing, the preset characters still work.

## Things to check on real devices

See `docs/real-device-test-matrix.md` for the general procedure. Game-specific checks:
- **Selfies**: on iPhone Safari and Android Chrome, "Take a photo" opens the front camera, crop and retake work, and denying the camera still lets you pick a preset.
- **Sound**: the soundtrack starts after "Settings & start", the stage bed stays quiet enough to talk over, and narration is intelligible from across the room.
- **Screen lock**: lock the presenter's phone mid-round. The TV should show "Paused — waiting for the presenter's phone", then resume on unlock.
- **Readability**: the TV headline, scorecard tiles and clock are readable from the couch.
