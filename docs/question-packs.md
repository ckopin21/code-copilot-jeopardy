# Question packs

Blue Stage uses built-in TypeScript packs under `src/packs/`. These packs are bundled into the static application and work with the authoritative browser game engine.

## Canonical authoring instructions for ChatGPT

When asking ChatGPT to add questions, give it this file and ask it to use **only** the explicit `category(..., { 100: question(...), ... })` format in the target `src/packs/*.ts` file. It must not edit `src/packs/generatedRegistry.ts`, `src/packs/index.ts`, game code, or the registry script.

- A pack filename and `id` use lowercase kebab-case; export exactly one `somethingPack` made by `buildPack(...)`.
- Each category has exactly `100`, `200`, `300`, `400`, `500`, and `1000`; adding more content means adding a complete category, not a partial row.
- Every clue and accepted answer is nonblank. Use an answer array only for genuinely accepted alternatives, never formatting/capitalization variants.
- IDs are generated; never write question IDs manually. `finalQuestionId`, when used, must reference a generated question in that same pack.
- Use only `responseMode: 'buzz' | 'text'` and `dailyDoubleEligible: true | false`; unsupported fields/configuration are prohibited.
- Search all `src/packs/*.ts` first. Exact normalized clue/answer pairs and explicit `factKey` repeats fail. Give true rewordings of the same fact the same `factKey` so validation rejects them; replace one clue instead.
- Highly similar clues with different answers are reported as **Near-duplicate question review** warnings. Review them and retain only legitimately distinct facts.

After every content change run `npm test && npm run build`. These commands regenerate the registry and fail on malformed packs, IDs, values, missing data, invalid references, and deterministic duplicates. Commit the regenerated registry only when `git diff` shows that the generator changed it.

## Fastest way to add a pack

1. Copy `src/packs/_pack.template.ts.example` to a new `.ts` file in `src/packs/`, for example `src/packs/geography.ts`.
2. Change the metadata and questions.
3. Export exactly one pack with a name ending in `Pack`, for example `export const geographyPack = buildPack(...)`.
4. Run any normal development command (`npm run dev`, `npm run typecheck`, `npm test`, or `npm run build`). The pack registry is generated automatically.

You do **not** edit `src/packs/index.ts` when adding a pack. `scripts/generate-pack-registry.mjs` discovers pack files and writes `src/packs/generatedRegistry.ts`.

You can also run the registry directly:

```bash
npm run packs:sync
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

`buildPack()` generates question IDs as `<pack-id>-<category-number>-<question-number>`, so the example above reserves the first category's sixth question when that question was not already used on the board.

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

## Built-in validation

`buildPack()` fails immediately when:

- pack ID is not lowercase/kebab-case
- title/theme/description is blank
- there are no categories
- category names are blank or duplicated
- a category does not contain all six supported point values
- question text or an accepted answer is blank

The catalog additionally rejects duplicate pack IDs, duplicate question IDs, questions whose `packId` does not match their pack, and invalid `finalQuestionId` references.

It also rejects repeated normalized clue text, repeated `factKey` values, and likely rewordings that share accepted answers. Formatting-only accepted-answer variants in a single clue are normalized to one answer. Highly similar clues with different answers are emitted as a clear `Near-duplicate question review` warning for human review rather than blocked automatically.

These checks run during normal typecheck/test/build flows because the generated registry is imported by the application.

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

There is currently no runtime JSON upload endpoint. The old Node/Express custom-pack import path was removed with the duplicate server runtime. New packs should be added under `src/packs/`, validated by the existing pack builder/tests, and deployed with the application.
