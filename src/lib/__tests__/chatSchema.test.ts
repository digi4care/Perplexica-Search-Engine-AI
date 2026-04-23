import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * Smoke tests for the chat API request schema.
 *
 * Extracted from src/app/api/chat/route.ts to test the validation
 * logic without needing the full route handler (which depends on
 * ModelRegistry, SearchAgent, SessionManager, DB singletons).
 */

const messageSchema = z.object({
  messageId: z.string().min(1, 'Message ID is required'),
  chatId: z.string().min(1, 'Chat ID is required'),
  content: z.string().min(1, 'Message content is required'),
});

const chatModelSchema = z.object({
  providerId: z.string({ message: 'Chat model provider id must be provided' }),
  key: z.string({ message: 'Chat model key must be provided' }),
});

const embeddingModelSchema = z.object({
  providerId: z.string({
    message: 'Embedding model provider id must be provided',
  }),
  key: z.string({ message: 'Embedding model key must be provided' }),
});

const bodySchema = z.object({
  message: messageSchema,
  optimizationMode: z.enum(['speed', 'balanced', 'quality'], {
    message: 'Optimization mode must be one of: speed, balanced, quality',
  }),
  sources: z.array(z.string()).optional().default([]),
  history: z
    .array(z.tuple([z.string(), z.string()]))
    .optional()
    .default([]),
  files: z.array(z.string()).optional().default([]),
  chatModel: chatModelSchema,
  embeddingModel: embeddingModelSchema,
  systemInstructions: z.string().nullable().optional().default(''),
});

describe('Chat API schema validation', () => {
  const validBody = {
    message: {
      messageId: 'msg-1',
      chatId: 'chat-1',
      content: 'Hello world',
    },
    optimizationMode: 'balanced' as const,
    chatModel: { providerId: 'openai', key: 'gpt-4' },
    embeddingModel: { providerId: 'openai', key: 'text-embedding-3' },
  };

  it('accepts a valid request body', () => {
    const result = bodySchema.safeParse(validBody);
    expect(result.success).toBe(true);
  });

  it('applies defaults for optional fields', () => {
    const result = bodySchema.parse(validBody);
    expect(result.sources).toEqual([]);
    expect(result.history).toEqual([]);
    expect(result.files).toEqual([]);
    expect(result.systemInstructions).toBe('');
  });

  it('accepts all three optimization modes', () => {
    for (const mode of ['speed', 'balanced', 'quality'] as const) {
      const result = bodySchema.safeParse({ ...validBody, optimizationMode: mode });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid optimization mode', () => {
    const result = bodySchema.safeParse({
      ...validBody,
      optimizationMode: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty message content', () => {
    const result = bodySchema.safeParse({
      ...validBody,
      message: { messageId: 'msg-1', chatId: 'chat-1', content: '' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing chatModel', () => {
    const { chatModel, ...withoutChatModel } = validBody;
    const result = bodySchema.safeParse(withoutChatModel);
    expect(result.success).toBe(false);
  });

  it('accepts valid history tuples', () => {
    const result = bodySchema.safeParse({
      ...validBody,
      history: [['user', 'hello'], ['assistant', 'hi']],
    });
    expect(result.success).toBe(true);
  });

  it('accepts nullable systemInstructions', () => {
    const result = bodySchema.safeParse({
      ...validBody,
      systemInstructions: null,
    });
    expect(result.success).toBe(true);
  });
});
