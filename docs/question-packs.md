# Question packs

Blue Stage uses built-in TypeScript packs under `src/packs/`. This page is the source of truth for adding and checking question content.

## Canonical authoring instructions for ChatGPT

When asking ChatGPT to add questions, give it this file and ask it to use the explicit `category(..., { 100: question(...), ... })` format in the target `src/packs/*.ts` file. The pack source is the only question content to edit. `src/packs/generatedRegistry.ts` is generated; do not edit it by hand.

- A pack filename and `id` use lowercase kebab-case; export exactly one `somethingPack` made by `buildPack(...)`.
- Each category has exactly `100`, `200`, `300`, `400`, `500`, and `1000`; adding 30 questions means appending five complete categories. Append new categories after existing ones so generated IDs remain stable.
- Every clue and accepted answer is nonblank. Use an answer array only for genuinely accepted alternatives, never formatting/capitalization variants.
- IDs are generated; never write question IDs manually. `finalQuestionId`, when used, must reference a generated question in that same pack.
- Use only `responseMode: 'buzz' | 'text'` and `dailyDoubleEligible: true | false`; unsupported fields/configuration are prohibited.
- Search all `src/packs/*.ts` first. Exact and normalized clue repeats fail, including changes only to case, punctuation, accents, or whitespace. Explicit `factKey` repeats also fail. If two clues test the same fact with different wording, give them the same `factKey`, then replace one clue.
- Similar wording or a shared answer plus substantial subject overlap is a **review candidate**, not proof of duplication. The question audit prints both clue locations and texts. Review each candidate; keep related clues that test different facts.

After every content change run `npm run packs:sync`, `npm run questions:check`, `npm run typecheck`, and `npm run build`. The checks fail on malformed packs, IDs, values, missing data, invalid references, deterministic duplicates, and registry drift. Read any near-duplicate review lines before committing. Commit the generated registry when the generator changes it.

## Fastest way to add a pack

1. Copy `src/packs/_pack.template.ts.example` to a new `.ts` file in `src/packs/`, for example `src/packs/geography.ts`.
2. Change the metadata and questions.
3. Export exactly one pack with a name ending in `Pack`, for example `export const geographyPack = buildPack(...)`.
4. Run `npm run packs:sync`, then `npm run questions:check`. Normal development commands also refresh the registry automatically.

You do **not** edit `src/packs/index.ts` when adding a pack. `scripts/generate-pack-registry.mjs` discovers pack files and writes `src/packs/generatedRegistry.ts`.

You can also run the registry directly:

```bash
npm run packs:sync
npm run packs:check
```

## Recommended authoring format

Use explicit point keys so adding/replacing a question cannot accidentally shift the difficulty/value of later questions:

```ts
import { buildPack, category, question } from './buildPack';

const categories = [
  category('World Capitals', {
    100: question('What is the capital of France?', 'Paris'),
    200: question('What is the capital of Japan?', 'Tokyo'),
    300: question('What is the capital of Canada?', 'Ottawa'),
    400: question('What is the capital of Australia?', 'Canberra', { responseMode: 'text' }),
    500: question('What is the capital of Bhutan?', 'Thimphu', { dailyDoubleEligible: false }),
    1000: question('What is the capital of Burkina Faso?', 'Ouagadougou')
  })
];

export const geographyPack = buildPack({
  id: 'geography',
  title: 'Geography',
  theme: 'Places, maps, capitals, and landmarks',
  description: 'A general geography pack.',
  difficulty: 'mixed',
  approximateMinutes: 35,
  accentColor: '#5eead4',
  categoryOrder: ['World Capitals'],
  finalQuestionId: 'geography-1-6'
}, categories);
```

`buildPack()` generates question IDs as `<pack-id>-<category-number>-<question-number>`, so the example above reserves the first category's sixth question when that question was not already used on the board. Reordering existing categories changes their IDs; append new categories instead.

The older tuple-array format used by the original built-in packs remains supported for compatibility, but the explicit value-map format above is preferred for new work.

## Optional pack presentation/control metadata

A pack may define:

- `accentColor`: CSS-compatible color for pack/presentation theming
- `titleArt`: optional image URL/data URL for future/pack-specific title art
- `categoryOrder`: preferred category sequence when category randomization is disabled
- `finalQuestionId`: preferred Final question from the same pack

All fields are optional. `finalQuestionId` is validated against questions in that pack and is only used if the question was not already consumed by the board.

## `question()` options

`question(text, answers, options)` supports:

- `answers`: one accepted answer string or an array of accepted alternatives
- `explanation`: optional context that remains hidden from player/presentation snapshots until answer reveal
- `tags`: arbitrary tags; `typed` or `free-response` implies text response unless `responseMode` is supplied
- `responseMode`: `buzz` or `text`
- `dailyDoubleEligible`: defaults to `true`
- `questionType`: optional answer type override; otherwise inferred
- `factKey`: optional semantic identity; use the same key for rewordings of the same underlying fact

Use `supportedGameModes: ['classic']`, `['free-response']`, or both when a pack is intended for those modes. Omission defaults to Classic. Free Response packs use `['free-response']` and the game applies typed answers for that mode.

## Built-in validation

`buildPack()` fails immediately when:

- pack ID is not lowercase/kebab-case
- title/theme/description is blank
- there are no categories
- category names are blank or duplicated
- a category does not contain all six supported point values
- question text or an accepted answer is blank

The catalog additionally rejects duplicate pack IDs, duplicate question IDs, questions whose `packId` does not match their pack, and invalid `finalQuestionId` references.

It also rejects repeated normalized clue text and repeated `factKey` values. Formatting-only accepted-answer variants in a single clue are normalized to one answer. Rewordings with shared answers and strongly similar clues are surfaced for human review, since topic overlap alone cannot prove that two clues test the same fact.

These checks run during normal typecheck/test/build flows because the generated registry is imported by the application. `npm run questions:check` prints near-duplicate candidates and checks the committed registry. CI runs the same check.

## Supported values and difficulty

Supported board values are:

```text
100, 200, 300, 400, 500, 1000
```

Pack builders infer difficulty by tier, and board generation prefers the expected difficulty when multiple same-value candidates are available:

- 100/200: easy
- 300: medium
- 400/500/1000: hard

The board generator still falls back to any valid same-value candidate rather than failing if a preferred-difficulty variant is unavailable.

## Adding questions to an existing pack

For a full six-row category, replace or add the question under the exact value key. A complete category must always have all six values so any game length can safely generate it.

If you want more total questions without changing existing categories, add another complete category. The board generator selects complete categories from the selected pack and tries to favor question IDs not recently used by that browser engine.

## Custom pack support

There is currently no runtime JSON upload endpoint. Add new packs under `src/packs/`, validate them with `npm run questions:check`, and include them in the application build.
