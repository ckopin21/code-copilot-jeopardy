# Question packs

Blue Stage uses built-in TypeScript packs under `src/packs/`. These packs are bundled into the static application and work with the authoritative browser game engine.

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
  approximateMinutes: 35
}, categories);
```

The older tuple-array format used by the original built-in packs remains supported for compatibility, but the explicit value-map format above is preferred for new work.

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

The catalog additionally rejects duplicate pack IDs, duplicate question IDs, and questions whose `packId` does not match their pack.

These checks run during normal typecheck/test/build flows because the generated registry is imported by the application.

## Supported values and difficulty

Supported board values are:

```text
100, 200, 300, 400, 500, 1000
```

Difficulty is inferred from the position/value tier inside a built-in category:

- 100/200: easy
- 300/400: medium
- 500/1000: hard

## Adding questions to an existing pack

For a full six-row category, replace or add the question under the exact value key. A complete category must always have all six values so any game length can safely generate it.

If you want more total questions without changing existing categories, add another complete category. The board generator selects complete categories from the selected pack and tries to favor question IDs not recently used by that browser engine.

## Custom pack support

There is currently no runtime JSON upload endpoint. The old Node/Express custom-pack import path was removed with the duplicate server runtime. New packs should be added under `src/packs/`, validated by the existing pack builder/tests, and deployed with the application.
