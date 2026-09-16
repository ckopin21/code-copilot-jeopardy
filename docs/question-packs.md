# Question pack format

Question packs are JSON objects accepted by `POST /api/packs/import` and validated before storage.

```json
{
  "id": "my-pack",
  "title": "My Pack",
  "theme": "A short theme",
  "description": "What this pack covers.",
  "difficulty": "mixed",
  "approximateMinutes": 35,
  "questions": [
    {
      "id": "my-pack-history-100",
      "packId": "my-pack",
      "category": "History",
      "text": "Which year did ...?",
      "acceptedAnswers": ["1901"],
      "alternateAnswers": [],
      "value": 100,
      "difficulty": "easy",
      "explanation": "Optional explanation.",
      "dailyDoubleEligible": true,
      "tags": ["history"]
    }
  ]
}
```

## Rules

- `id` must use lowercase letters, digits, and hyphens.
- Each question ID must be unique within the pack.
- Every question's `packId` must exactly match the pack ID.
- Supported values are `100`, `200`, `300`, `400`, `500`, and `1000`.
- `acceptedAnswers` must contain at least one answer.
- Difficulty is `easy`, `medium`, `hard`, or pack-level `mixed`.
- Imported packs require at least 12 questions.
- A standard six-row category should include one question at every supported value.

Custom packs are persisted to `.data/custom-packs.json`. Keep `.data` on persistent storage in production if you want imports and active rooms to survive instance replacement.
