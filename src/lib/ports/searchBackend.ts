/**
 * Port interface for web search backend (SearxNG).
 *
 * Wraps the searchSearxng function, abstracting the HTTP call
 * to the SearxNG meta-search engine instance.
 */

export interface SearchResult {
  title: string;
  url: string;
  img_src?: string;
  thumbnail_src?: string;
  thumbnail?: string;
  content?: string;
  author?: string;
  iframe_src?: string;
}

export interface SearchOptions {
  categories?: string[];
  engines?: string[];
  language?: string;
  pageno?: number;
}

export interface SearchBackend {
  /**
   * Execute a search query against the backend.
   * Returns matching results and autocomplete suggestions.
   */
  search(
    query: string,
    options?: SearchOptions,
  ): Promise<{
    results: SearchResult[];
    suggestions: string[];
  }>;
}
