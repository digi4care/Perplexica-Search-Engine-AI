import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChatService from '../chatService';
import type { ChatRequest } from '../chatService';

vi.mock('@/lib/composition', () => ({
  getModelRegistry: vi.fn(() => ({
    loadChatModel: vi.fn().mockResolvedValue({ id: 'test-llm' }),
    loadEmbeddingModel: vi.fn().mockResolvedValue({ id: 'test-embedding' }),
  })),
  getSearchBackend: vi.fn(() => ({ id: 'test-backend' })),
  createSearchAgent: vi.fn(() => ({
    searchAsync: vi.fn(),
  })),
  createSession: vi.fn(() => ({ id: 'session-1', subscribe: vi.fn() })),
}));

vi.mock('@/lib/db', () => ({
  default: {
    query: { chats: { findFirst: vi.fn().mockReturnValue({ execute: vi.fn().mockResolvedValue(null) }) } },
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({}) }),
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
}));

vi.mock('@/lib/db/schema', () => ({
  chats: { id: 'id' },
}));

vi.mock('@/lib/uploads/manager', () => ({
  default: { getFile: vi.fn().mockReturnValue({ name: 'test.pdf' }) },
}));

const baseRequest: ChatRequest = {
  message: { messageId: 'msg-1', chatId: 'chat-1', content: 'Hello' },
  optimizationMode: 'balanced',
  sources: ['web'],
  history: [],
  files: [],
  chatModel: { providerId: 'openai', key: 'gpt-4' },
  embeddingModel: { providerId: 'openai', key: 'text-embedding-3' },
  systemInstructions: null,
};

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(() => {
    service = new ChatService();
  });

  it('returns a session from handleChat', async () => {
    const result = await service.handleChat(baseRequest);
    expect(result.session).toBeDefined();
    expect(result.session.id).toBe('session-1');
  });

  it('maps history entries correctly: human → user, other → assistant', async () => {
    const { createSearchAgent } = await import('@/lib/composition');
    const mockAgent = { searchAsync: vi.fn() };
    vi.mocked(createSearchAgent).mockReturnValue(mockAgent as any);

    const request: ChatRequest = {
      ...baseRequest,
      history: [
        ['human', 'What is AI?'],
        ['ai', 'AI is...'],
        ['assistant', 'Let me explain...'],
      ],
    };

    await service.handleChat(request);

    expect(mockAgent.searchAsync).toHaveBeenCalledOnce();
    const callArgs = mockAgent.searchAsync.mock.calls[0][1];
    expect(callArgs.chatHistory).toEqual([
      { role: 'user', content: 'What is AI?' },
      { role: 'assistant', content: 'AI is...' },
      { role: 'assistant', content: 'Let me explain...' },
    ]);
  });

  it('defaults systemInstructions to "None" when null', async () => {
    const { createSearchAgent } = await import('@/lib/composition');
    const mockAgent = { searchAsync: vi.fn() };
    vi.mocked(createSearchAgent).mockReturnValue(mockAgent as any);

    const request: ChatRequest = { ...baseRequest, systemInstructions: null };
    await service.handleChat(request);

    const callArgs = mockAgent.searchAsync.mock.calls[0][1];
    expect(callArgs.config.systemInstructions).toBe('None');
  });

  it('uses provided systemInstructions when non-empty', async () => {
    const { createSearchAgent } = await import('@/lib/composition');
    const mockAgent = { searchAsync: vi.fn() };
    vi.mocked(createSearchAgent).mockReturnValue(mockAgent as any);

    const request: ChatRequest = { ...baseRequest, systemInstructions: 'Be concise' };
    await service.handleChat(request);

    const callArgs = mockAgent.searchAsync.mock.calls[0][1];
    expect(callArgs.config.systemInstructions).toBe('Be concise');
  });

  it('passes all request fields to agent config', async () => {
    const { createSearchAgent } = await import('@/lib/composition');
    const mockAgent = { searchAsync: vi.fn() };
    vi.mocked(createSearchAgent).mockReturnValue(mockAgent as any);

    await service.handleChat(baseRequest);

    const callArgs = mockAgent.searchAsync.mock.calls[0][1];
    expect(callArgs.followUp).toBe('Hello');
    expect(callArgs.chatId).toBe('chat-1');
    expect(callArgs.messageId).toBe('msg-1');
    expect(callArgs.config.mode).toBe('balanced');
    expect(callArgs.config.sources).toEqual(['web']);
    expect(callArgs.config.fileIds).toEqual([]);
  });

  it('loads chat and embedding models concurrently', async () => {
    const { getModelRegistry } = await import('@/lib/composition');
    const mockRegistry = {
      loadChatModel: vi.fn().mockResolvedValue({ id: 'llm' }),
      loadEmbeddingModel: vi.fn().mockResolvedValue({ id: 'emb' }),
    };
    vi.mocked(getModelRegistry).mockReturnValue(mockRegistry as any);

    await service.handleChat(baseRequest);

    expect(mockRegistry.loadChatModel).toHaveBeenCalledWith('openai', 'gpt-4');
    expect(mockRegistry.loadEmbeddingModel).toHaveBeenCalledWith('openai', 'text-embedding-3');
  });
});
