import fs from 'node:fs';
import path from 'node:path';

export interface PersistenceAdapter<T> {
  load(): T[];
  save(records: T[]): void;
}

export class JsonFilePersistence<T> implements PersistenceAdapter<T> {
  constructor(private readonly filePath: string) {}

  load(): T[] {
    try {
      if (!fs.existsSync(this.filePath)) return [];
      return JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as T[];
    } catch (error) {
      console.warn(`Could not load ${this.filePath}:`, error);
      return [];
    }
  }

  save(records: T[]): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(records, null, 2));
    fs.renameSync(temporary, this.filePath);
  }
}

export class MemoryPersistence<T> implements PersistenceAdapter<T> {
  records: T[] = [];
  load(): T[] { return structuredClone(this.records); }
  save(records: T[]): void { this.records = structuredClone(records); }
}
