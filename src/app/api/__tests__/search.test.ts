import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/composition', () => {
  const mockSession = {
    id: 'test-session',
    subscribe: vi.fn().mockImplementation((listener: any) => {
      listener('end', {});
      return () => {};
    }),
    emit: vi.fn(),
    emitBlock: vi.fn(),
    getBlock: vi.fn(),
    updateBlock: vi.fn(),
    getAllBlocks: vi.fn().mockReturnValue([]),
    removeAllListeners: vi.fn(),
  };
  return {
    createApiSearchAgent: vi.fn().mockReturnValue({ searchAsync: vi.fn() }),
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
  SSE_HEADERS: {
    'Content-Type': 'text/event-stream',
    Connection: 'keep-alive',
    'Cache-Control': 'no-cache, no-transform',
  },
}));

import { POST } from '@/app/api/search/route';

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBody = {
  query: 'test query',
  sources: ['web'],
  chatModel: { providerId: 'openai', key: 'gpt-4o' },
  embeddingModel: { providerId: 'openai', key: 'text-embedding-3-small' },
};

describe('POST /api/search', () => {
  it('returns 200 for valid non-streaming request', async () => {
    const res = await POST(makeRequest({ ...validBody, stream: false }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('message');
    expect(body).toHaveProperty('sources');
  });

  it('returns 400 for missing query', async () => {
    const { query, ...noQuery } = validBody;
    const res = await POST(makeRequest(noQuery));
    expect(res.status).toBe(400);
  });

  it('returns 400 for empty sources', async () => {
    const res = await POST(makeRequest({ ...validBody, sources: [] }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid source value', async () => {
    const res = await POST(makeRequest({ ...validBody, sources: ['google'] }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing chatModel', async () => {
    const { chatModel, ...noChatModel } = validBody;
    const res = await POST(makeRequest(noChatModel));
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing embeddingModel', async () => {
    const { embeddingModel, ...noEmbedding } = validBody;
    const res = await POST(makeRequest(noEmbedding));
    expect(res.status).toBe(400);
  });

  it('accepts optional fields with defaults', async () => {
    const minimal = {
      query: 'hello',
      sources: ['web'],
      chatModel: { providerId: 'openai', key: 'gpt-4o' },
      embeddingModel: { providerId: 'openai', key: 'text-embedding-3-small' },
    };
    const res = await POST(makeRequest(minimal));
    expect(res.status).toBe(200);
  });
});
