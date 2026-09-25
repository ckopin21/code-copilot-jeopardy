import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

/** Every relative import in a file, resolved to a repo-relative path with forward slashes. */
function imports(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  return [...text.matchAll(/(?:from|import)\s*\(?\s*'(\.{1,2}\/[^']+)'/g)]
    .map((match) => path.relative(root, path.resolve(path.dirname(file), match[1])).split(path.sep).join('/'));
}

describe('module boundaries', () => {
  it('keeps platform code independent of any game', () => {
    const offenders = [...sourceFiles(path.join(root, 'src/platform')), ...sourceFiles(path.join(root, 'server'))]
      .filter((file) => !file.endsWith(path.join('server', 'games.ts')))
      .flatMap((file) => imports(file).filter((target) => target.startsWith('src/games/')).map((target) => `${path.relative(root, file)} -> ${target}`));
    expect(offenders).toEqual([]);
  });

  it('keeps games independent of each other', () => {
    const gamesDir = path.join(root, 'src/games');
    const games = readdirSync(gamesDir).filter((name) => statSync(path.join(gamesDir, name)).isDirectory());
    const offenders = games.flatMap((game) => sourceFiles(path.join(gamesDir, game)).flatMap((file) =>
      imports(file)
        .filter((target) => target.startsWith('src/games/') && !target.startsWith(`src/games/${game}/`))
        .map((target) => `${path.relative(root, file)} -> ${target}`)
    ));
    expect(offenders).toEqual([]);
  });
});
