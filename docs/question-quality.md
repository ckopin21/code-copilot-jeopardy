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
- Catalog validation reports likely rewordings when they target the same accepted answer and substantially overlap on subject terms. Very similar clues with different answers are also printed as `Near-duplicate review` warnings. Review candidates manually; two clues about the same topic can test different facts.
- If two differently worded clues test the same underlying fact, authors should still give both the same explicit `factKey`; that is the strongest deterministic duplicate check.
- Question IDs are also globally unique.

Deterministic duplicate checks run when the pack catalog is imported, so typecheck, tests, and production builds fail on definite duplicates. Run `npm run questions:check` to inspect near-duplicate candidates and verify generated registry state.

## Pack author checklist

1. Keep each category complete for every supported point value.
2. Make difficulty rise with point value, not with trick wording.
3. Search existing packs before adding a fact.
4. Set an explicit `factKey` when a new clue is a rewording of an existing fact.
5. Use a `questionType` override only when automatic inference is misleading.
6. Run `npm test`, which audits every built-in pack at Quick, Standard, and Marathon lengths and exercises the full multiplayer game lifecycle.
