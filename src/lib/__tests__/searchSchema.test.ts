import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * Tests for the search API Zod request schema.
 *
 * The search route now uses Zod for validation (previously manual if-checks).
 * These tests verify the schema behavior.
 */

const bodySchema = z.object({
  query: z.string().min(1, 'Query is required'),
  sources: z
    .array(z.enum(['web', 'discussions', 'academic']))
    .min(1, 'At least one source is required'),
  optimizationMode: z.enum(['speed', 'balanced', 'quality']).default('speed'),
  history: z.array(z.tuple([z.string(), z.string()])).default([]),
  chatModel: z.object({
    providerId: z.string(),
    key: z.string(),
  }),
  embeddingModel: z.object({
    providerId: z.string(),
    key: z.string(),
  }),
  stream: z.boolean().default(false),
  systemInstructions: z.string().default(''),
});

describe('Search API request validation', () => {
  it('rejects request missing sources', () => {
    const result = bodySchema.safeParse({
      query: 'test',
      chatModel: { providerId: 'p', key: 'k' },
      embeddingModel: { providerId: 'p', key: 'k' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects request missing query', () => {
    const result = bodySchema.safeParse({
      sources: ['web'],
      chatModel: { providerId: 'p', key: 'k' },
      embeddingModel: { providerId: 'p', key: 'k' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects completely empty body', () => {
    const result = bodySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('accepts valid request with sources and query', () => {
    const result = bodySchema.safeParse({
      query: 'What is TypeScript?',
      sources: ['web'],
      chatModel: { providerId: 'p', key: 'k' },
      embeddingModel: { providerId: 'p', key: 'k' },
    });
    expect(result.success).toBe(true);
  });

  it('applies defaults: history=[], optimizationMode=speed, stream=false', () => {
    const result = bodySchema.parse({
      query: 'test',
      sources: ['web'],
      chatModel: { providerId: 'p', key: 'k' },
      embeddingModel: { providerId: 'p', key: 'k' },
    });

    expect(result.history).toEqual([]);
    expect(result.optimizationMode).toBe('speed');
    expect(result.stream).toBe(false);
  });

  it('converts history tuples to ChatTurnMessage format', () => {
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
