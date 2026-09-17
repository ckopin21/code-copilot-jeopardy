import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('host buzzer countdown lifecycle', () => {
  it('keys the auto-open countdown to stable question primitives', () => {
    const source = readFileSync(new URL('../src/components/HostAppV3.tsx', import.meta.url), 'utf8');
    expect(source).toContain('[autoBuzzEligible, autoBuzzQuestionId, perform]');
    expect(source).not.toContain('[room?.currentQuestion, room?.phase, perform]');
  });
});
