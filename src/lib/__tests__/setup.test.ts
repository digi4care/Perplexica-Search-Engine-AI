import { describe, it, expect } from 'vitest';

describe('Vitest setup', () => {
  it('runs a basic assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('resolves @/ path alias', async () => {
    // This proves the alias works without import errors
    const types = await import('@/lib/types');
    // Module loads without error — types are type-only exports
    expect(typeof types).toBe('object');
  });
});
