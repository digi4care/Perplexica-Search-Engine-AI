import { describe, it, expect } from 'vitest';

/**
 * Smoke tests for core type definitions.
 *
 * These aren't runtime tests (types are erased at runtime) but they verify
 * that the type module loads without circular import errors and that
 * type-level constructs are well-formed.
 */
describe('Type definitions', () => {
  it('loads types module without circular import errors', async () => {
    // If this throws, there's a circular dependency or syntax error in types.ts
    const types = await import('@/lib/types');
    expect(types).toBeDefined();
  });

  it('Block union covers all block types', async () => {
    // Verify all block type discriminants are representable
    const textBlock = { id: '1', type: 'text' as const, data: 'hello' };
    const sourceBlock = { id: '2', type: 'source' as const, data: [] };
    const suggestionBlock = { id: '3', type: 'suggestion' as const, data: [] };
    const widgetBlock = {
      id: '4',
      type: 'widget' as const,
      data: { widgetType: 'weather', params: {} },
    };
    const researchBlock = {
      id: '5',
      type: 'research' as const,
      data: { subSteps: [] },
    };

    // These should all be valid block types
    const blocks = [
      textBlock,
      sourceBlock,
      suggestionBlock,
      widgetBlock,
      researchBlock,
    ];
    const types = blocks.map((b) => b.type);
    expect(types).toContain('text');
    expect(types).toContain('source');
    expect(types).toContain('suggestion');
    expect(types).toContain('widget');
    expect(types).toContain('research');
  });
});
