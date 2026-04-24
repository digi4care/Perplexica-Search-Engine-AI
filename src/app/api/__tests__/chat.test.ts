import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/composition', () => {
  const mockSession = {
    id: 'test-session',
    subscribe: vi.fn().mockReturnValue(() => {}),
    emit: vi.fn(),
    emitBlock: vi.fn(),
    getBlock: vi.fn(),
    updateBlock: vi.fn(),
    getAllBlocks: vi.fn().mockReturnValue([]),
    removeAllListeners: vi.fn(),
  };
  return {
    createSearchAgent: vi.fn().mockReturnValue({ searchAsync: vi.fn() }),
    createSession: vi.fn().mockReturnValue(mockSession),
    getSearchBackend: vi.fn().mockReturnValue({ search: vi.fn() }),
    getModelRegistry: vi.fn().mockReturnValue({
      loadChatModel: vi.fn().mockResolvedValue({ generateText: vi.fn() }),
      loadEmbeddingModel: vi.fn().mockResolvedValue({ embedText: vi.fn() }),
      activeProviders: [],
    }),
  };
});

vi.mock('@/lib/http/sessionStream', () => ({
  createSessionStream: vi.fn().mockReturnValue({
    readable: new ReadableStream({
      start(controller) {
        controller.close();
      },
    }),
    close: vi.fn(),
  }),
  SSE_HEADERS: {
    'Content-Type': 'text/event-stream',
    Connection: 'keep-alive',
    'Cache-Control': 'no-cache, no-transform',
  },
}));

vi.mock('@/lib/db', () => ({
  default: {
    query: { chats: { findFirst: vi.fn().mockReturnValue({ execute: vi.fn().mockResolvedValue(undefined) }) } },
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ execute: vi.fn() }) }),
  },
}));
vi.mock('drizzle-orm', () => ({ eq: vi.fn() }));
vi.mock('@/lib/db/schema', () => ({ chats: {} }));
vi.mock('@/lib/uploads/manager', () => ({ default: { getFile: vi.fn() } }));

import { POST } from '@/app/api/chat/route';

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBody = {
  message: { messageId: 'msg-1', chatId: 'chat-1', content: 'Hello' },
  optimizationMode: 'balanced' as const,
  sources: [],
  history: [],
  files: [],
  chatModel: { providerId: 'openai', key: 'gpt-4o' },
  embeddingModel: { providerId: 'openai', key: 'text-embedding-3-small' },
  systemInstructions: '',
};

describe('POST /api/chat', () => {
  it('returns 200 with SSE headers for valid body', async () => {
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
  });

  it('returns 400 for missing message', async () => {
    const { message, ...noMessage } = validBody;
    const res = await POST(makeRequest(noMessage));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('Invalid request body');
  });

  it('returns 400 for empty message content', async () => {
    const res = await POST(
      makeRequest({
        ...validBody,
        message: { ...validBody.message, content: '' },
      }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing chatModel', async () => {
    const { chatModel, ...noChatModel } = validBody;
    const res = await POST(makeRequest(noChatModel));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid optimizationMode', async () => {
    const res = await POST(
      makeRequest({ ...validBody, optimizationMode: 'turbo' }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing embeddingModel', async () => {
    const { embeddingModel, ...noEmbedding } = validBody;
    const res = await POST(makeRequest(noEmbedding));
    expect(res.status).toBe(400);
  });

  it('accepts optional fields with defaults', async () => {
    const minimal = {
      message: { messageId: 'msg-1', chatId: 'chat-1', content: 'Hi' },
      optimizationMode: 'speed',
      chatModel: { providerId: 'openai', key: 'gpt-4o' },
      embeddingModel: { providerId: 'openai', key: 'text-embedding-3-small' },
    };
    const res = await POST(makeRequest(minimal));
    expect(res.status).toBe(200);
  });
});
