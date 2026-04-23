import { describe, it, expect } from 'vitest';
import { createMockSearchBackend } from './fixtures';

/**
 * Smoke tests for the search backend abstraction.
 *
 * Validates the mock factory behaves correctly. Once the real SearXNG
 * integration is behind a port interface, these patterns apply to the adapter.
 */
describe('SearchBackend mock', () => {
  it('returns default results without HTTP calls', async () => {
    const backend = createMockSearchBackend();
    const results = await backend.search('test query');
    expect(results).toHaveLength(2);
    expect(results[0]).toHaveProperty('title', 'Test Result 1');
    expect(results[0]).toHaveProperty('url');
    expect(results[0]).toHaveProperty('content');
  });

  it('records queries for assertion', async () => {
    const backend = createMockSearchBackend();
    await backend.search('first query');
    await backend.search('second query');
    expect(backend.queries).toEqual(['first query', 'second query']);
  });

  it('supports custom result overrides', async () => {
    const customResults = [
      { title: 'Custom', url: 'https://custom.com', content: 'Custom content' },
    ];
    const backend = createMockSearchBackend(customResults);
    const results = await backend.search('anything');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Custom');
  });
});
