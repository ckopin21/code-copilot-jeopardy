# Question quality and catalog rules

Blue Stage treats the question catalog as validated game data, not loose content.

## Difficulty curve

Built-in packs use the same point-to-difficulty curve:

- 100 and 200: easy, broad recognition or everyday knowledge.
- 300 and 400: medium, familiar subjects with one extra step of recall.
- 500 and 1000: hard, but still intended to be answerable by a well-rounded non-specialist.

A hard clue should not depend on a specialist citation, tiny statistic, obscure date, or niche terminology unless the subject itself makes that knowledge broadly recognizable.

## Question type

Every compiled question records a `questionType`. The pack builder infers a type such as `person`, `place`, `time`, `title`, `term`, `number`, `object`, `organization`, `event`, or `general`. Authors can override the inferred type with `question(..., { questionType: ... })` when needed.

## No repeated questions or facts

Every compiled question also records a `factKey`.

- By default, `factKey` is derived from normalized question text.
- Exact or punctuation-only question repeats are rejected automatically.
- If two differently worded clues test the same underlying fact, authors must give both the same explicit `factKey`. Catalog validation then rejects the duplicate before the game builds.
- Question IDs are also globally unique.

These checks run when the pack catalog is imported, so typecheck, tests, and production builds fail instead of shipping duplicated question data.

## Pack author checklist

1. Keep each category complete for every supported point value.
2. Make difficulty rise with point value, not with trick wording.
3. Search existing packs before adding a fact.
4. Set an explicit `factKey` when a new clue is a rewording of an existing fact.
5. Use a `questionType` override only when automatic inference is misleading.
6. Run `npm test`, which audits every built-in pack at Quick, Standard, and Marathon lengths.
