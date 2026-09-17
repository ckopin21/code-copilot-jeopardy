# Developer Mode

Developer Mode is a host-side testing surface for validating multiplayer visuals and scoring without needing multiple phones.

## Access

Open a normal host game and use the **DEV** pill in the lower-left corner. Developer Mode is intentionally unavailable on player and presentation screens.

## What it tests

- Synthetic 2–5 player score states.
- Turn ownership and last-place comeback qualification.
- Normal, late-game 2×/3×, and comeback-modified question values.
- Remaining comeback boost uses.
- Correct, wrong/no-answer, and other-player scoring values.
- Final wager caps, loss protection, leader caps, and All In eligibility.
- Multi-player PlayerStrip layouts and selected visual states.
- Real ScoreFlight animation component for positive, negative, and comeback awards.
- 2× and 3× modifier reveal overlays.
- Final reveal sequence.
- Round-start, Daily Double, Final Round, and results transition animations.
- Comeback boost banner.

## Safety

Developer Mode is a sandbox. It does not write scores, consume questions, change turns, create players, or mutate the active room. The **Copy live scores into sandbox** button only copies the current room values into local React state so calculations can be inspected against the live setup.

The calculation inspector calls the same `calculateComebackAward` and `finalWagerRules` functions used by the live game rather than duplicating those formulas.
