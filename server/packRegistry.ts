import fs from 'node:fs';
import path from 'node:path';
import type { PackSummary, QuestionPack } from '../src/shared/types.js';
import { builtInPacks } from '../src/packs/index.js';
import { packSchema } from '../src/shared/validation.js';

export class PackRegistry {
  private packs = new Map<string, QuestionPack>();
  private customFile: string;

  constructor(customFile = path.resolve('.data/custom-packs.json')) {
    this.customFile = customFile;
    for (const pack of builtInPacks) this.packs.set(pack.id, pack);
    this.loadCustom();
  }

  private loadCustom(): void {
    try {
      if (!fs.existsSync(this.customFile)) return;
      const parsed = JSON.parse(fs.readFileSync(this.customFile, 'utf8')) as unknown[];
      for (const candidate of parsed) {
        const result = packSchema.safeParse(candidate);
        if (result.success) this.packs.set(result.data.id, result.data as QuestionPack);
      }
    } catch (error) {
      console.warn('Could not load custom packs:', error);
    }
  }

  private persistCustom(): void {
    const builtInIds = new Set(builtInPacks.map((pack) => pack.id));
    const custom = [...this.packs.values()].filter((pack) => !builtInIds.has(pack.id));
    fs.mkdirSync(path.dirname(this.customFile), { recursive: true });
    fs.writeFileSync(this.customFile, JSON.stringify(custom, null, 2));
  }

  list(): PackSummary[] {
    return [...this.packs.values()].map(({ id, title, theme, description, questions, difficulty, approximateMinutes }) => ({
      id,
      title,
      theme,
      description,
      questionCount: questions.length,
      difficulty,
      approximateMinutes
    }));
  }

  get(id: string): QuestionPack | undefined {
    return this.packs.get(id);
  }

  all(): QuestionPack[] {
    return [...this.packs.values()];
  }

  import(input: unknown): QuestionPack {
    const parsed = packSchema.parse(input) as QuestionPack;
    if (builtInPacks.some((pack) => pack.id === parsed.id)) {
      throw new Error('Custom pack ID conflicts with a built-in pack');
    }
    const ids = new Set<string>();
    for (const question of parsed.questions) {
      if (question.packId !== parsed.id) throw new Error(`Question ${question.id} has the wrong packId`);
      if (ids.has(question.id)) throw new Error(`Duplicate question id: ${question.id}`);
      ids.add(question.id);
    }
    this.packs.set(parsed.id, parsed);
    this.persistCustom();
    return parsed;
  }
}
