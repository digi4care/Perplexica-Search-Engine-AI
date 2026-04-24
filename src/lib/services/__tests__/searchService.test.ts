import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import SearchService from '@/lib/services/searchService';

// --- Zod schema tests (extracted from the route) ---

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

describe('Search API Zod schema validation', () => {
  const validBody = {
    query: 'What is TypeScript?',
    sources: ['web'] as const,
    chatModel: { providerId: 'openai', key: 'gpt-4' },
    embeddingModel: { providerId: 'openai', key: 'text-embedding-3' },
  };

  it('accepts a valid request body', () => {
    const result = bodySchema.safeParse(validBody);
    expect(result.success).toBe(true);
  });

  it('applies defaults for optional fields', () => {
    const result = bodySchema.parse(validBody);
    expect(result.optimizationMode).toBe('speed');
    expect(result.history).toEqual([]);
    expect(result.stream).toBe(false);
    expect(result.systemInstructions).toBe('');
  });

  it('rejects request missing query', () => {
    const { query, ...without } = validBody;
    const result = bodySchema.safeParse(without);
    expect(result.success).toBe(false);
  });

  it('rejects empty query', () => {
    const result = bodySchema.safeParse({ ...validBody, query: '' });
    expect(result.success).toBe(false);
  });

  it('rejects request missing sources', () => {
    const { sources, ...without } = validBody;
    const result = bodySchema.safeParse(without);
    expect(result.success).toBe(false);
  });

  it('rejects empty sources array', () => {
    const result = bodySchema.safeParse({ ...validBody, sources: [] });
    expect(result.success).toBe(false);
  });

  it('rejects invalid source type', () => {
    const result = bodySchema.safeParse({ ...validBody, sources: ['invalid'] });
    expect(result.success).toBe(false);
  });

  it('accepts all three optimization modes', () => {
    for (const mode of ['speed', 'balanced', 'quality'] as const) {
      const result = bodySchema.safeParse({ ...validBody, optimizationMode: mode });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid optimization mode', () => {
    const result = bodySchema.safeParse({ ...validBody, optimizationMode: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('accepts valid history tuples', () => {
    const result = bodySchema.safeParse({
      ...validBody,
      history: [['human', 'What is React?'], ['assistant', 'A UI library.']],
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing chatModel', () => {
    const { chatModel, ...without } = validBody;
    const result = bodySchema.safeParse(without);
    expect(result.success).toBe(false);
  });

  it('rejects missing embeddingModel', () => {
    const { embeddingModel, ...without } = validBody;
    const result = bodySchema.safeParse(without);
    expect(result.success).toBe(false);
  });
});

// --- SearchService tests ---

vi.mock('@/lib/composition', () => ({
  getModelRegistry: vi.fn(),
  getSearchBackend: vi.fn(() => ({})),
  createApiSearchAgent: vi.fn(),
  createSession: vi.fn(),
}));

import {
  getModelRegistry,
  createApiSearchAgent,
  getSearchBackend,
  createSession,
} from '@/lib/composition';

function createMockSession() {
  const listeners: Record<string, Array<(data: any) => void>> = {};
  return {
    id: 'test-session-id',
    subscribe: vi.fn((handler: (event: string, data: any) => void) => {
      const originalListeners = { ...listeners };
      return () => {
        Object.keys(originalListeners).forEach((k) => delete listeners[k]);
      };
    }),
    emit: vi.fn((event: string, data: any) => {}),
    removeAllListeners: vi.fn(),
    on: vi.fn(),
  };
}

describe('SearchService', () => {
  let service: SearchService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SearchService();
  });

  describe('handleSearch', () => {
    it('loads models, maps history, creates session and starts agent', async () => {
      const mockSession = createMockSession();
      const mockLlm = { streamText: vi.fn() };
      const mockEmbeddings = {};

      vi.mocked(getModelRegistry).mockReturnValue({
        loadChatModel: vi.fn().mockResolvedValue(mockLlm),
        loadEmbeddingModel: vi.fn().mockResolvedValue(mockEmbeddings),
      } as any);
      vi.mocked(createSession).mockReturnValue(mockSession as any);
      vi.mocked(getSearchBackend).mockReturnValue({} as any);

      const mockAgent = { searchAsync: vi.fn() };
      vi.mocked(createApiSearchAgent).mockReturnValue(mockAgent as any);

      const result = await service.handleSearch({
        query: 'What is TypeScript?',
        optimizationMode: 'speed',
        sources: ['web'],
        history: [
          ['human', 'What is JS?'],
          ['assistant', 'A programming language.'],
        ],
        chatModel: { providerId: 'openai', key: 'gpt-4' },
        embeddingModel: { providerId: 'openai', key: 'text-embedding-3' },
      });

      expect(result.session).toBe(mockSession);
      expect(getModelRegistry).toHaveBeenCalledOnce();
      expect(createSession).toHaveBeenCalledOnce();
      expect(createApiSearchAgent).toHaveBeenCalledOnce();
      expect(mockAgent.searchAsync).toHaveBeenCalledOnce();

      // Verify history mapping
      const agentInput = mockAgent.searchAsync.mock.calls[0][1];
      expect(agentInput.chatHistory).toEqual([
        { role: 'user', content: 'What is JS?' },
        { role: 'assistant', content: 'A programming language.' },
      ]);
    });

    it('maps human→user and anything else→assistant', async () => {
      const mockSession = createMockSession();
      vi.mocked(getModelRegistry).mockReturnValue({
        loadChatModel: vi.fn().mockResolvedValue({}),
        loadEmbeddingModel: vi.fn().mockResolvedValue({}),
      } as any);
      vi.mocked(createSession).mockReturnValue(mockSession as any);
      vi.mocked(getSearchBackend).mockReturnValue({} as any);

      const mockAgent = { searchAsync: vi.fn() };
      vi.mocked(createApiSearchAgent).mockReturnValue(mockAgent as any);

      await service.handleSearch({
        query: 'test',
        optimizationMode: 'balanced',
        sources: ['academic'],
        history: [
          ['human', 'q1'],
          ['ai', 'a1'],
          ['assistant', 'a2'],
          ['human', 'q2'],
        ],
        chatModel: { providerId: 'p', key: 'k' },
        embeddingModel: { providerId: 'p', key: 'k' },
      });

      const agentInput = mockAgent.searchAsync.mock.calls[0][1];
      expect(agentInput.chatHistory).toEqual([
        { role: 'user', content: 'q1' },
        { role: 'assistant', content: 'a1' },
        { role: 'assistant', content: 'a2' },
        { role: 'user', content: 'q2' },
      ]);
    });

    it('passes correct config to agent', async () => {
      const mockSession = createMockSession();
      vi.mocked(getModelRegistry).mockReturnValue({
        loadChatModel: vi.fn().mockResolvedValue('llm'),
        loadEmbeddingModel: vi.fn().mockResolvedValue('emb'),
      } as any);
      vi.mocked(createSession).mockReturnValue(mockSession as any);
      vi.mocked(getSearchBackend).mockReturnValue('backend' as any);

      const mockAgent = { searchAsync: vi.fn() };
      vi.mocked(createApiSearchAgent).mockReturnValue(mockAgent as any);

      await service.handleSearch({
        query: 'test query',
        optimizationMode: 'quality',
        sources: ['web', 'academic'],
        history: [],
        chatModel: { providerId: 'openai', key: 'gpt-4' },
        embeddingModel: { providerId: 'openai', key: 'text-embedding-3' },
        systemInstructions: 'Be precise',
      });

      const agentInput = mockAgent.searchAsync.mock.calls[0][1];
      expect(agentInput.config).toMatchObject({
        llm: 'llm',
        embedding: 'emb',
        searchBackend: 'backend',
        sources: ['web', 'academic'],
        mode: 'quality',
        fileIds: [],
        systemInstructions: 'Be precise',
      });
      expect(agentInput.followUp).toBe('test query');
      expect(agentInput.chatId).toBeDefined();
      expect(agentInput.messageId).toBeDefined();
    });

    it('defaults systemInstructions to empty string', async () => {
      const mockSession = createMockSession();
      vi.mocked(getModelRegistry).mockReturnValue({
        loadChatModel: vi.fn().mockResolvedValue({}),
        loadEmbeddingModel: vi.fn().mockResolvedValue({}),
      } as any);
      vi.mocked(createSession).mockReturnValue(mockSession as any);
      vi.mocked(getSearchBackend).mockReturnValue({} as any);

      const mockAgent = { searchAsync: vi.fn() };
      vi.mocked(createApiSearchAgent).mockReturnValue(mockAgent as any);

      await service.handleSearch({
        query: 'test',
        optimizationMode: 'speed',
        sources: ['web'],
        history: [],
        chatModel: { providerId: 'p', key: 'k' },
        embeddingModel: { providerId: 'p', key: 'k' },
      });

      const agentInput = mockAgent.searchAsync.mock.calls[0][1];
      expect(agentInput.config.systemInstructions).toBe('');
    });
  });

  describe('collectResults', () => {
    it('collects response text and sources, resolves on end', async () => {
      const mockSession = createMockSession();
      let subscriber: ((event: string, data: any) => void) | null = null;

      mockSession.subscribe.mockImplementation(
        (handler: (event: string, data: any) => void) => {
          subscriber = handler;
          return () => {};
        },
      );

      const promise = service.collectResults(mockSession as any);

      // Simulate events
      subscriber!('data', { type: 'response', data: 'Hello ' });
      subscriber!('data', { type: 'response', data: 'world' });
      subscriber!('data', { type: 'searchResults', data: [{ title: 'Result 1' }] });
      subscriber!('end', {});

      const result = await promise;
      expect(result.message).toBe('Hello world');
      expect(result.sources).toEqual([{ title: 'Result 1' }]);
    });

    it('rejects on error event', async () => {
      const mockSession = createMockSession();
      let subscriber: ((event: string, data: any) => void) | null = null;

      mockSession.subscribe.mockImplementation(
        (handler: (event: string, data: any) => void) => {
          subscriber = handler;
          return () => {};
        },
      );

      const promise = service.collectResults(mockSession as any);

      subscriber!('error', { data: 'Something went wrong' });

      await expect(promise).rejects.toThrow('Search error');
    });
  });
});
