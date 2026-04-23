/**
 * Creates a fake SearXNG search backend for testing.
 *
 * Returns deterministic results without making HTTP calls.
 */
export interface MockSearchResult {
  title: string;
  url: string;
  content: string;
}

export function createMockSearchBackend(
  defaultResults?: MockSearchResult[],
) {
  const queries: string[] = [];
  const results = defaultResults ?? [
    { title: 'Test Result 1', url: 'https://example.com/1', content: 'Test content 1' },
    { title: 'Test Result 2', url: 'https://example.com/2', content: 'Test content 2' },
  ];

  return {
    /** Record of all queries received */
    queries,

    /** Search with optional override results */
    async search(query: string, _opts?: Record<string, unknown>) {
      queries.push(query);
      return results.map((r) => ({
        title: r.title,
        url: r.url,
        content: r.content,
        engine: 'mock',
        score: 1,
        category: 'general',
      }));
    },
  };
}

export type MockSearchBackend = ReturnType<typeof createMockSearchBackend>;
