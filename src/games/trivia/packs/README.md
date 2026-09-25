# Adding questions and packs

For full details, see [`docs/question-packs.md`](../../../../docs/question-packs.md).

## New pack

1. Copy `_pack.template.ts.example` to a new `.ts` file in this folder.
2. Rename the exported pack, metadata ID/title/theme/description, and categories.
3. Fill every category with `100`, `200`, `300`, `400`, `500`, and `1000` questions.
4. Run `npm run packs:sync`, `npm run questions:check`, `npm run typecheck`, and `npm run build`.

No registry file needs to be edited. `scripts/generate-pack-registry.mjs` discovers the new pack automatically.

Preferred format:

```ts
category('Category Name', {
  100: question('Question?', 'Answer'),
  200: question('Question?', ['Primary answer', 'Accepted alternate']),
  300: question('Question?', 'Answer'),
  400: question('Question?', 'Answer', { responseMode: 'text' }),
  500: question('Question?', 'Answer', { dailyDoubleEligible: false }),
  1000: question('Question?', 'Answer')
})
```

## Add questions to an existing pack

A playable category is always a complete six-value set. To expand a pack, add another complete category. To replace a question, edit only its explicit point-value entry.

The builder/catalog validation catches missing values, blank text/answers, invalid modes and metadata, duplicate categories, duplicate pack IDs, duplicate question IDs, and mismatched `packId` values. `npm run questions:check` also prints near-duplicate review candidates and detects registry drift.
