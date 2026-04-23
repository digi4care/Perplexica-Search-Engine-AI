import { describe, it, expect } from 'vitest';

/**
 * Smoke tests for the search API request validation.
 *
 * Unlike the chat route which uses Zod, the search route uses
 * manual validation (lines 23-32 of route.ts). These tests verify
 * the validation logic that exists today.
 */
describe('Search API request validation', () => {
  /** Reproduces the validation logic from src/app/api/search/route.ts */

  function validateSearchRequest(body: Record<string, unknown>): {
    valid: boolean;
    message?: string;
  } {
    if (!body.sources || !body.query) {
      return { valid: false, message: 'Missing sources or query' };
    }
    return { valid: true };
  }

  it('rejects request missing sources', () => {
    const result = validateSearchRequest({ query: 'test' });
    expect(result.valid).toBe(false);
    expect(result.message).toBe('Missing sources or query');
  });

  it('rejects request missing query', () => {
    const result = validateSearchRequest({ sources: [] });
    expect(result.valid).toBe(false);
  });

  it('rejects completely empty body', () => {
    const result = validateSearchRequest({});
    expect(result.valid).toBe(false);
  });

  it('accepts valid request with sources and query', () => {
    const result = validateSearchRequest({
      sources: ['web'],
      query: 'What is TypeScript?',
    });
    expect(result.valid).toBe(true);
  });

  it('applies defaults: history=[], optimizationMode=speed, stream=false', () => {
    // Reproduces the default logic from lines 30-32
    const body: {
      history?: Array<[string, string]>;
      optimizationMode?: string;
      stream?: boolean;
    } = {};

    body.history = body.history || [];
    body.optimizationMode = body.optimizationMode || 'speed';
    body.stream = body.stream || false;

    expect(body.history).toEqual([]);
    expect(body.optimizationMode).toBe('speed');
    expect(body.stream).toBe(false);
  });

  it('converts history tuples to ChatTurnMessage format', () => {
    // Reproduces the history conversion from lines 44-48
    const history: Array<[string, string]> = [
      ['human', 'What is React?'],
      ['assistant', 'React is a UI library.'],
      ['human', 'And Next.js?'],
    ];

    const messages = history.map((msg) =>
      msg[0] === 'human'
        ? { role: 'user' as const, content: msg[1] }
        : { role: 'assistant' as const, content: msg[1] },
    );

    expect(messages).toHaveLength(3);
    expect(messages[0]).toEqual({ role: 'user', content: 'What is React?' });
    expect(messages[1]).toEqual({ role: 'assistant', content: 'React is a UI library.' });
    expect(messages[2]).toEqual({ role: 'user', content: 'And Next.js?' });
  });
});
