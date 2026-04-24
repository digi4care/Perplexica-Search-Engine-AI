import { searchSearxng } from '@/lib/searxng';
import type { SearchBackend, SearchResult, SearchOptions } from '@/lib/ports';

/**
 * Adapter that implements SearchBackend by delegating to the searchSearxng function.
 */
export class SearxngSearchBackend implements SearchBackend {
  async search(
    query: string,
    options?: SearchOptions,
  ): Promise<{ results: SearchResult[]; suggestions: string[] }> {
    return searchSearxng(query, options);
  }
}
