# Deal or Dud

A four-player, same-room pitch game and the second game on the platform (`src/games/deal-or-dud/`, id `deal-or-dud`). Everyone builds a ridiculous product, then takes a turn pitching it while the other three players are the sharks: one minute of pitch, then questions, reactions and "I'm out!", then secret bids and a drumroll reveal. Only the presenter scores: a point for every $100K raised. Everyone presents once per pass; a game is one, two or three passes (4, 8 or 12 rounds).

Start it from the game picker at `/`, or go straight to `/?game=deal-or-dud&mode=host` on the TV laptop. Phones join by QR code, the join link, or the room key typed at `/`. Join buttons stay greyed out until the typed key belongs to a running game (`src/platform/net/useRoomLookup.ts`, used by the picker and the Deal or Dud phone join), and the TV shows the room key in the top corner all game so anyone who drops can get back in from `/`.

## Screens

| Screen | Where | Shows |
| --- | --- | --- |
| Host (TV) | `?game=deal-or-dud&mode=host` | In the lobby: the join card and "Settings & start" (the game starts from the settings page; there is no separate start button). Studio set, the product on stage (big during pitch time), the Pitch time / Questions open banner, floating reactions, "Ben is out!" stings, clock, the bid reveal, scores and end awards. Host controls, settings, and the soundtrack. |
| Presentation | Host's display link | The same TV view for a second screen, including the lobby's join card (QR code, room key, link, who is in, and who can start the game). It has no host controls. Plays sound by default, like the Host tab. |
| Every phone, at the start | `?mode=player` | Three quick card picks (product, twist, audience) and the business name, then "Locked in" (the name can still change) until everyone is done. |
| Presenter phone | `?mode=player` | Their product card and a big clock (pitch time, then the stage clock). Nothing else to read: they pitch. |
| Shark phone | `?mode=player` | During pitch time: the product and "Just listen!" with no buttons. Then reactions (😂 🔥 🤔 💀), "I'm out!" (tap twice) and "Ready to bid". Then the secret bid. At the reveal: "Watch the TV!" until the total is up. |
| First player's phone | same | Adds a 🎛 button: start the game (once four players are ready), pause/resume, lock everyone in, skip to questions, skip to bids, skip the waits, volumes, and Play again at the end. So a game can run from the TV display and phones alone; settings (timers, tutorial) are only on the Host screen. |

Before the reveal, nobody sees another shark's bid (a phone sees only its own; who has locked and who is out, with its $0, are public), a product stays on its own phone until its round goes on stage, and nobody sees anyone else's seat code. That boundary is `engine/sanitize.ts` and is covered by `tests/deal-or-dud/engine.test.ts`.

## Game flow (all enforced in `engine/DealEngine.ts`)

**Build, before each pass** (default 1:15). Everyone builds their own product on their phone at the same time, in three steps in reading order: a **twist**, a **product**, and **who it's for** ("Radioactive gas station sushi for the IRS"). Each step deals 6 cards, has 🔀 New cards and Back, and a "✏️ Write your own" card for typing that part yourself (40 characters; `player:builder-custom`, stored in `builder.custom`, shown with a ✏️ on the product card). The twist and product cards filter each other, so a twist only ever sits on a product it fits (a written-in part fits anything). The "Your business" preview is the sentence with a slot per step, the one being picked highlighted. Then the player types a business name (free text, 32 characters; `player:business-name`): a generated name is the placeholder and is used if the box is left empty, and 🎲 drops in a generated idea. Then "Lock it in"; the name can still change until the build ends. The server deals the hands so no two players hold the same product. Each phone sees only its own; the TV shows who has locked in. The last lock starts the pass's first round; when the clock runs out (or the host taps "Lock everyone in"), open products lock as they are and any empty step gets a random card that fits. The four products wait in `upcoming` (in join order, which is the pitch order) until their round. Nobody else sees a product until its round goes on stage. With more than one pitch per player, each new pass opens with the fanfare and the hosts ("That's everyone! But the tank isn't closed yet…", "Last time around!…"), and the TV shows "Pitch 2 of 3".

Then four rounds, each opening straight on stage:

1. **On stage** (one clock, default 3:00, 1:00 to 10:00 in settings).
   - **Pitch time** comes first: 60 seconds, or the first third of a clock under 3:00 (`pitchSeconds()` in `types.ts`). The TV shows the product big (its three card emojis, the name and the headline) with a "Pitch time!" banner, the presenter's phone shows the product and a big clock, and the sharks just listen: their phones show "Pitch time. Just listen!" and no buttons (the user's call).
   - Then the narrator says "**Questions open!**" and the sharks ask real questions out loud. There are no suggested questions or pitch ideas. The product moves to a small card in the corner of the TV.
   - Once questions are open, each shark's phone has **reactions** 😂 🔥 🤔 💀 (they float up from that shark's seat on the TV and score nothing; taps closer than 0.6 s apart are dropped), **I'm out!** (tap, then tap again: the TV slams "Ben is out!", the narrator says it, and that shark's bid locks at $0), and **Ready to bid** (a second tap takes it back).
   - The stage ends when the clock runs out, when every shark still in is ready, or when the host skips (the first skip ends pitch time, the second opens the bids). If all three sharks say they're out, the bids are skipped and the reveal comes next.
2. **Bids** (45s). Each shark still in picks $0 to $500K in $100K steps, labelled 🙅 No way, 🤏 A little, 🙂 Maybe, 👍 I like it, 😍 Love it, 🔥 Take my money, and locks it (final). Bids are secret until the reveal; the TV shows who has locked. A bid that isn't locked counts as $0.
3. **The reveal** (10s). A drumroll, then the bids flip one at a time from lowest to highest, then the total ("$900K raised!"). The top bidder "makes the deal" ("Ava is in!") just for show; a tie at the top means "Ava and Ben both want in!". Then the points. The phones keep the total hidden until the TV shows it. The timings are `revealSchedule()` in `ui/labels.ts` (flips at 1.4, 3.0 and 4.6 s, the total at 6.2 s, squeezed on a shorter reveal timer), shared by the TV, the sound and the narrator.
4. **Scores** (5s). Both the reveal and the scores are skippable, and both lengths are host timers.

**Settings.** The main settings page has **Pitches per player** (1, 2 or 3: 4, 8 or 12 rounds; each extra pass starts with a fresh build where everyone makes a new product, `settings.pitches`, `totalRounds()`), the stage clock (Quick 2:00, Standard 3:00, Relaxed 4:00, or ± in 30s steps up to 10:00), the tutorial and captions checkboxes, and audio. **More timers…** opens a separate page for the flat timers: product builder 1:15, offer lock 45s, the bid reveal 10s, scores between rounds 5s, tiebreaker guess 20s, with a reset. There is no tone choice: every game deals from the whole deck (`GAME_TONE` in `types.ts`). "Replay tutorial" shows only between rounds; before the game the tutorial checkbox decides. There is no asking price (it was proposed and turned down).

After the last round a tie at the top goes to the **Final Forecast** tiebreaker: tied players guess a number privately; closest wins; one repeat with a new card; then a random draw.

**Scoring** lives in `engine/scoring.ts`:

- **Only the presenter scores:** 1 point per $100K raised in total (0 to 15). Sharks earn nothing for their bids or for going out (the user's call; an earlier "read the room" bonus was removed).
- **Bonus points** for the presenter, each switchable under "Bonus points" in the settings (`settings.bonuses`, `BONUS_POINTS` in `types.ts`): **Nobody walked out** +2 (no shark said "I'm out"), **Standing ovation** +3 (all three sharks bid $300K or more). They show as chips at the reveal and in the presenter's score line.
- **The votes** (`vote` then `vote-result` phases, after the last round, before the final scores; 45 s, skippable): every phone picks a **Best business name** (+3) and a **Pitch of the night** (+5), never its own, and locks both at once (`player:votes`). Votes are secret until counted (`sanitize.ts`); most votes wins, ties share the points, and nobody voting means no winner. The TV lists the nominees, then the winners for 10 s. Either vote can be switched off; with both off the game goes straight to the final scores.
- Example: bids of $100K, $300K and $500K raise $900K, so the presenter gets 9.

**End awards** (for fun, no points; `gameAwards()`), shown on the winner screen and the phones: **Silver Tongue** (most raised in one pitch), **Tightwad** (smallest bids in total), **Big Spender** (largest bids in total). Ties share the title; an award nobody really earned (nothing raised, everyone bid the same) is left out.

## Phone layout

Every phone screen fits the viewport without page scrolling: a header (name, score, room key and seat code, clock), the screen's content, and its main button at the bottom of the column. The builder shows one step of four big cards at a time, the presenter sees the product and a big clock, and a shark on stage has the product, one row of four reaction buttons, "I'm out!" and "Ready to bid". On a very small screen the content area can still scroll as a fallback. The e2e test checks both at 390×844.

## Pause and disconnects

- The Host or the first player can pause at any time. Every deadline shifts by the paused time.
- If the presenter's phone drops mid-round, the round pauses by itself and resumes when it reconnects. A phone dropping during the build doesn't pause; its product locks with the others.
- Rooms saved mid-game by an older version (before the shared build, with the fact-card dossier, or with the scorecard, peeks and partner phase) go back to their lobby on load with their players, and so does a finished game from the scorecard version (its results have no bids to show). Old timer settings are migrated in `migrateSettings()`: a save without a stage clock gets the one its named preset means (else 3:00), missing timers (the bid reveal, scores) get their defaults, kept values are clamped, and the tone becomes the game tone.
- A server restart restores rooms paused.
- The game needs exactly four players. Removing a player mid-game returns the room to the lobby. In the lobby, the Host screen shows a Remove button (with a confirm) next to any offline player, so an abandoned seat never blocks the start.
- **Seat codes.** Every player gets a 4-digit seat code, shown under their name on their phone with the room key. Entering the room key and seat code on any phone ("Already playing? Get your seat back") takes the seat back and signs the old phone out. Ten wrong codes in a minute pause further tries. Only the owner's phone ever receives its code.
- A phone that reopens the join link or types the room key at `/` returns to its saved seat automatically. It forgets the seat only if the server says the seat or room is gone, not on a network error.
- **Leaving.** The Leave button in the phone header (or the Back button) asks "Leave the game?": **Leave for now** keeps the seat for coming back with the seat code; **Leave for good** (`player:leave`) frees the seat, passes host controls to the next player, and mid-game sends everyone back to the lobby (the game needs four).
- A room key typed into the trivia join screen that belongs to another game opens that game instead, and the trivia menu has an "All games" button back to the picker.
- One browser tab keeps one connection across games, so joining or reconnecting to a seat replaces any seat that tab held in another game instead of being refused.
- Settings are locked once a game starts, except audio and captions.

## Content (`src/games/deal-or-dud/content/`)

- `words.ts`: the builder cards, each with an emoji: 115 products, 69 twists, 70 audiences. The deck is deliberately absurd, the kind of thing that would get you sued ("Radioactive gas station sushi for the IRS", "definitely-not-stolen raccoon butlers for your ex"), but never sexual. Business names are just as bad (`NAME_PATTERNS` in `cues.ts`: "Totally Legit Sushi LLC", "Dr. Toast (Not a Real Doctor)"). Twists list the product forms they fit (food, gadget, goods, pet, service, rental, digital, event), and a twist hand only deals ones that fit the picked product, so headlines never break.
- `dealer.ts`: hands, headlines and business names.
- `cues.ts`: business-name patterns, avatar presets, tiebreaker cards.
- Products and headlines never repeat within a game.
- The scorecard, peeks, pitch ideas, suggested questions and "what happened later" lines were removed in the pitch-game redesign (they are in git history before it).

`tests/deal-or-dud/content.test.ts` enforces the content rules:
- ids are unique and every card has an emoji
- every product has at least 8 twists that fit it
- nothing in the deck, the names, the avatars or the tiebreaker cards is sexual
- there is enough material for four rounds

Run it after any content edit:

```bash
npx vitest run tests/deal-or-dud
```

The tests can't check whether a headline reads naturally. Read new cards aloud with a few twists and audiences before shipping them.

## Audio (`public/deal-or-dud/audio/`)

- **Music and stings** are Pixabay tracks the user picked (Pixabay Content License, no attribution required; `CREDITS.md` in the audio folder lists each track, artist and page). The untouched downloads are on the Windows PC in `C:\Users\caleb\code\tools\deal-or-dud-audio-backup\pixabay\`, and `C:\Users\caleb\code\tools\deal-or-dud-music\integrate_pixabay.sh` turns them into the game files (its `README.md` explains how the loop points were found). Everything is loudness-matched: loops −16 LUFS, stings −14 to −15.
  - **Loops** (MP3, 192 kbps): lobby (`lobby-loop.mp3`, 118 s), build and stage bed (`discussion-bed.mp3`, 76 s), bids (`offer-pulse.mp3`, 21.6 s), and the after-winner loop (`winner-loop.mp3`, 45 s). Each loop is a whole number of bars cut where the music matches itself, with a short crossfade. MP3 blurs the first and last milliseconds of a file, so each file carries half a second of wrapped audio on both ends, and `dealAudio.ts` loops between `loopStart` and `loopEnd` (the exact loop lengths are in `MUSIC_FILES`). Re-rendering a loop means updating its sample count there.
  - **Stings:** fanfare (the first 4 bars of Breaking News, game start and final scores), pitch intro (2 bars of the Breaking News logo, each round going on stage), the tada (`reveal-good.mp3`, when the total is up) and buzzer (`reveal-bad.mp3`, "I'm out!" and a $0 total), winner.
  - **No overlap:** a loop change fades the old loop out in about half a second and brings the new one in just after. A phase change also fades out any musical sting still playing (`dealAudio.stopStings()`), so skipping the tutorial right after the opening fanfare doesn't leave it under the next loop. A phase that opens with a musical sting (the opening fanfare, the round sting on stage, the final-scores fanfare, the winner) plays the sting alone; the phase's loop starts when the sting ends (`useSoundtrack.ts`, timed from each sting's real length).
  - **Game over:** music stays off while the winner sting plays, then the after-winner loop starts (timed from the sting's real length) and runs until the host plays again (back to the lobby loop) or closes the screen. A screen opened on a finished game starts the loop at once.
  - Earlier sets are backed up in `tools\deal-or-dud-audio-backup\`: `music-v1\` (synthesized; its generator `scripts/deal-or-dud/render-music.ts` was removed and is in git history) and `music-v2-acestep\` (ACE-Step drafts, made by `tools\ace-step\`).
- **Sound effects** `lock.mp3` (poker chips), `card.mp3` (card placed) and `tick.mp3` come from Kenney's CC0 packs (kenney.nl: Casino Audio, Interface Sounds). The tick counts down the last 5 seconds of the build, bid and tiebreaker clocks. `card.mp3` also plays as each bid flips at the reveal. `drumroll.mp3` (4.9 s, under the flips) is synthesized by `C:\Users\caleb\code\tools\deal-or-dud-music\drumroll.cjs` (a snare roll that swells), then loudness-matched with ffmpeg.
- Sound is on by default on the Host tab and the Presentation screen (phones never play music). Each screen tries to start sound as it opens; browsers that block that start it at the first click, tap or key press anywhere on the page (`audio/useAutoSound.ts`), and "Play sound here" shows until then. If the Host tab and a Presentation screen are both open in the same room, untick "Play sound on this screen" in the host settings so the room hears one soundtrack. Music ducks under narration, and so do the long stings (fanfare, pitch intro, winner), by about 6 dB, because the hosts talk over them. The stage bed plays at a low level; the offer pulse is only slightly louder.

### The hosts (narration)

Two host voices, `adam` and `george`, take turns. They are cloned by Chatterbox (MIT, runs on the PC's GPU) from reference clips made with Kokoro-82M.

- **Fixed lines** (phase calls, "Round one!" to "Round eleven!" with "Final round!" on the last round whatever the count, time warnings, "Questions open!", "All three sharks are out!", one "…dollars raised!" line for every total from $100K to $1.5M) are in `src/games/deal-or-dud/audio/narrationLines.ts` and recorded to `voice/<line>-<variant>-<voice>.mp3`. The tutorial script is `tutorialScript.ts`; its clips are `tut-*.mp3`, and `narrationDurations.ts` is generated with them.
- **Live lines** say player names, never products or companies (a lobby greeting such as "Ava is in the building!" or "Make some noise for Ava!", a stage intro from `PITCH_INTROS` such as "Hold on to your wallets. It's Ben!", a different one each round, "Cy is out!", "Ava is in!", "Ava and Ben both want in!"). The lobby has eight greetings (`JOIN_GREETINGS`); each seat gets a different one, starting at a point set by the room key, and the two voices alternate. Each round opens with the round call, the presenter intro (just their name: the product is theirs to reveal), then "The floor is yours. Sell it!" The reveal opens with "Let's see those offers." and, as the last bid flips (on a timer in `useNarration.ts`, `revealTotalPlan()`), the total and who is in, or "Not a single offer!" The TV asks `/api/deal-or-dud/voice`, which forwards to the narrator service on the same computer (`DEAL_VOICE_URL`, default `http://127.0.0.1:5123`).
- **Rendered ahead** by the server (`voicePrep.ts`, from `onStateChange`): each player's name lines while the lobby fills (including "X is out!" and "X is in!"), every pitch intro as soon as its product locks during the build, and on stage "X and Y both want in!" for each pair of that round's sharks. Only the narrator's cache is filled, so a product stays secret until its pitch. This is what keeps a slower computer (a MacBook Air) on time: by round 2 the intros play instantly.
- **Without the narrator service** (or if a line takes over 4 seconds) the TV plays a fixed fallback line instead ("Our next entrepreneur is in the hot seat!"), so the game never waits on it.
- **What is said when** is decided in `audio/narrationPlan.ts` (pure, tested in `tests/deal-or-dud/narration.test.ts`) and played by `audio/narrator.ts`, one line at a time. A new phase cuts off the previous line. Stage warnings play at 60 s (on clocks of 2:00 or more), 30 s (55 s or more) and 10 s, and are dropped if they cannot start within 2.5 s.
- **The tutorial** (`tutorialScript.ts`, 6 steps, about 35 s): four players and four rounds, the shared build, pitch time, questions open (reactions and "I'm out"), secret bids, and scoring (a point per $100K raised; raise the most to win). The demos sit in empty parts of the set, clear of the sharks, the presenter and their nameplates, and the captions sit bottom left under the sharks. The TV shows a demo for each step (`TutorialDemo` in `ui/TvStage.tsx`).
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

- **3D emoji art.** Avatars, builder cards, reactions, bid labels and award icons draw as Microsoft Fluent Emoji 3D images (MIT; the notice is `public/deal-or-dud/art/LICENSE-fluent-emoji.txt`). `scripts/deal-or-dud/copy-art.ts` copies the image for every emoji in the content pools from the full set (`C:\Users\caleb\code\tools\fluent-emoji\assets\`, or `FLUENT_EMOJI=<folder>`) into `public/deal-or-dud/art/<code points>.png` at 128px, and writes `src/games/deal-or-dud/artManifest.ts`. `ui/Emoji.tsx` draws the image when one exists and the text emoji otherwise, so a new word with a new emoji still works; re-run the script (with `FFMPEG=<path>`) to give it art.
- **Motion** is CSS only: builder cards deal in, the product card pops up for the pitch, reactions float up from the sharks' seats, "is out!" slams in, bids flip over one after another at the reveal while the unflipped ones wobble, the total slams down, points rows and standings slide in, scores count up on the nameplates (`ui/CountUp.tsx`), and banners and headlines slide in on each phase. Everything switches off under the system's reduce-motion setting.

## Selfies

"Take a photo" is a file input with `capture="user"`, so a tap opens the phone's own camera app. This works over the plain-HTTP LAN; an in-page live camera would need HTTPS. The phone then crops the photo to 192px. Photos live only in the room's saved state and expire with the room (12 hours idle). If the camera is refused or missing, the preset characters still work.

## Things to check on real devices

See `docs/real-device-test-matrix.md` for the general procedure. Game-specific checks:
- **Selfies**: on iPhone Safari and Android Chrome, "Take a photo" opens the front camera, crop and retake work, and denying the camera still lets you pick a preset.
- **Sound**: the soundtrack starts after "Settings & start", the stage bed stays quiet enough to talk over, and narration is intelligible from across the room.
- **Screen lock**: lock the presenter's phone mid-round. The TV should show "Paused — waiting for the presenter's phone", then resume on unlock.
- **Readability**: the TV headline, the product card, reactions, the reveal and the clock are readable from the couch.
