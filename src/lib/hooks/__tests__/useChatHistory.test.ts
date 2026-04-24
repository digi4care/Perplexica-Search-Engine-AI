// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useChatHistory } from '../useChatHistory';
import { Message } from '@/components/ChatWindow';
import { Block } from '@/lib/types';

// ── Helpers ──────────────────────────────────────────────────────────

const textBlock = (data: string): Block => ({
  id: 'b1',
  type: 'text',
  data,
});

const makeMessage = (
  overrides: Partial<Message> & { responseBlocks?: Block[] } = {},
): Message => ({
  chatId: 'chat-1',
  messageId: 'msg-1',
  backendId: 'be-1',
  query: 'test query',
  responseBlocks: overrides.responseBlocks ?? [textBlock('response text')],
  status: 'completed',
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  ...overrides,
});

const apiResponse = (overrides: { messages?: Message[]; sources?: string[]; files?: any[] } = {}) => ({
  messages: overrides.messages ?? [makeMessage()],
  chat: {
    sources: overrides.sources ?? ['web'],
    files: overrides.files ?? [],
  },
});

/** Params as a tuple so renderHook can spread them positionally. */
type HookParams = [string | undefined, boolean, (s: string[]) => void];

const makeParams = (overrides: {
  chatId?: string | undefined;
  newChatCreated?: boolean;
  setSources?: (s: string[]) => void;
} = {}): HookParams => [
  overrides.chatId,
  overrides.newChatCreated ?? false,
  overrides.setSources ?? vi.fn(),
];

// ── Tests ────────────────────────────────────────────────────────────

describe('useChatHistory', () => {
  beforeEach(() => {
    document.title = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns initial state with empty arrays, not loaded, not notFound', () => {
    const { result } = renderHook(
      ({ chatId, newChatCreated, setSources }) =>
        useChatHistory(chatId, newChatCreated, setSources),
      { initialProps: { chatId: undefined, newChatCreated: false, setSources: vi.fn() } },
    );

    expect(result.current.messages).toEqual([]);
    expect(result.current.files).toEqual([]);
    expect(result.current.fileIds).toEqual([]);
    // chatId is undefined → the effect immediately sets isMessagesLoaded=true
    expect(result.current.isMessagesLoaded).toBe(true);
    expect(result.current.notFound).toBe(false);
    expect(result.current.chatHistory.current).toEqual([]);
  });

  it('sets isMessagesLoaded=true when chatId is undefined', async () => {
    const { result } = renderHook(
      ({ chatId, newChatCreated, setSources }) =>
        useChatHistory(chatId, newChatCreated, setSources),
      { initialProps: { chatId: undefined, newChatCreated: false, setSources: vi.fn() } },
    );

    await waitFor(() => {
      expect(result.current.isMessagesLoaded).toBe(true);
    });
  });

  it('loads messages when chatId is set, newChatCreated=false, not yet loaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        json: () => Promise.resolve(apiResponse()),
      }),
    );

    const { result } = renderHook(
      ({ chatId, newChatCreated, setSources }) =>
        useChatHistory(chatId, newChatCreated, setSources),
      { initialProps: { chatId: 'chat-1' as string | undefined, newChatCreated: false, setSources: vi.fn() } },
    );

    await waitFor(() => {
      expect(result.current.isMessagesLoaded).toBe(true);
    }, { timeout: 3000 });

    expect(result.current.messages.length).toBeGreaterThan(0);
  });

  it('fetches /api/chats/{chatId} on load', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve(apiResponse()),
    });
    vi.stubGlobal('fetch', mockFetch);

    renderHook(
      ({ chatId, newChatCreated, setSources }) =>
        useChatHistory(chatId, newChatCreated, setSources),
      { initialProps: { chatId: 'chat-42' as string | undefined, newChatCreated: false, setSources: vi.fn() } },
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/chats/chat-42', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
    }, { timeout: 3000 });
  });

  it('parses messages correctly into chatHistory', async () => {
    const msgs = [
      makeMessage({ query: 'hello', responseBlocks: [textBlock('world')] }),
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        json: () => Promise.resolve(apiResponse({ messages: msgs })),
      }),
    );

    const { result } = renderHook(
      ({ chatId, newChatCreated, setSources }) =>
        useChatHistory(chatId, newChatCreated, setSources),
      { initialProps: { chatId: 'chat-1' as string | undefined, newChatCreated: false, setSources: vi.fn() } },
    );

    await waitFor(() => {
      expect(result.current.isMessagesLoaded).toBe(true);
    }, { timeout: 3000 });

    expect(result.current.chatHistory.current).toEqual([
      ['human', 'hello'],
      ['assistant', 'world'],
    ]);
  });

  it('extracts text blocks from responseBlocks into history', async () => {
    const msgs = [
      makeMessage({
        responseBlocks: [
          textBlock('first'),
          { id: 'b2', type: 'source', data: [] } as Block,
          textBlock('second'),
        ],
      }),
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        json: () => Promise.resolve(apiResponse({ messages: msgs })),
      }),
    );

    const { result } = renderHook(
      ({ chatId, newChatCreated, setSources }) =>
        useChatHistory(chatId, newChatCreated, setSources),
      { initialProps: { chatId: 'chat-1' as string | undefined, newChatCreated: false, setSources: vi.fn() } },
    );

    await waitFor(() => {
      expect(result.current.isMessagesLoaded).toBe(true);
    }, { timeout: 3000 });

    const assistantEntry = result.current.chatHistory.current.find(
      ([role]) => role === 'assistant',
    );
    expect(assistantEntry).toBeDefined();
    expect(assistantEntry![1]).toBe('first\nsecond');
  });

  it('sets notFound=true on 404 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 404 }),
    );

    const { result } = renderHook(
      ({ chatId, newChatCreated, setSources }) =>
        useChatHistory(chatId, newChatCreated, setSources),
      { initialProps: { chatId: 'chat-missing' as string | undefined, newChatCreated: false, setSources: vi.fn() } },
    );

    await waitFor(() => {
      expect(result.current.notFound).toBe(true);
    }, { timeout: 3000 });
  });

  it('sets isMessagesLoaded=true after 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 404 }),
    );

    const { result } = renderHook(
      ({ chatId, newChatCreated, setSources }) =>
        useChatHistory(chatId, newChatCreated, setSources),
      { initialProps: { chatId: 'chat-missing' as string | undefined, newChatCreated: false, setSources: vi.fn() } },
    );

    await waitFor(() => {
      expect(result.current.isMessagesLoaded).toBe(true);
    }, { timeout: 3000 });
    expect(result.current.notFound).toBe(true);
  });

  it('sets document.title to first message query', async () => {
    const msgs = [
      makeMessage({ query: 'my special query' }),
      makeMessage({ query: 'second query', messageId: 'msg-2' }),
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        json: () => Promise.resolve(apiResponse({ messages: msgs })),
      }),
    );

    renderHook(
      ({ chatId, newChatCreated, setSources }) =>
        useChatHistory(chatId, newChatCreated, setSources),
      { initialProps: { chatId: 'chat-1' as string | undefined, newChatCreated: false, setSources: vi.fn() } },
    );

    await waitFor(() => {
      expect(document.title).toBe('my special query');
    }, { timeout: 3000 });
  });

  it('extracts files from response data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        json: () =>
          Promise.resolve(
            apiResponse({
              files: [
                { name: 'report.pdf', fileId: 'file-1' },
                { name: 'data.csv', fileId: 'file-2' },
              ],
            }),
          ),
      }),
    );

    const { result } = renderHook(
      ({ chatId, newChatCreated, setSources }) =>
        useChatHistory(chatId, newChatCreated, setSources),
      { initialProps: { chatId: 'chat-1' as string | undefined, newChatCreated: false, setSources: vi.fn() } },
    );

    await waitFor(() => {
      expect(result.current.isMessagesLoaded).toBe(true);
    }, { timeout: 3000 });

    expect(result.current.files).toEqual([
      { fileName: 'report.pdf', fileExtension: 'pdf', fileId: 'file-1' },
      { fileName: 'data.csv', fileExtension: 'csv', fileId: 'file-2' },
    ]);
  });

  it('sets fileIds from files', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        json: () =>
          Promise.resolve(
            apiResponse({
              files: [
                { name: 'doc.pdf', fileId: 'f-1' },
                { name: 'img.png', fileId: 'f-2' },
              ],
            }),
          ),
      }),
    );

    const { result } = renderHook(
      ({ chatId, newChatCreated, setSources }) =>
        useChatHistory(chatId, newChatCreated, setSources),
      { initialProps: { chatId: 'chat-1' as string | undefined, newChatCreated: false, setSources: vi.fn() } },
    );

    await waitFor(() => {
      expect(result.current.isMessagesLoaded).toBe(true);
    }, { timeout: 3000 });

    expect(result.current.fileIds).toEqual(['f-1', 'f-2']);
  });

  it('calls setSources with chat sources', async () => {
    const setSources = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        json: () =>
          Promise.resolve(apiResponse({ sources: ['web', 'academic'] })),
      }),
    );

    renderHook(
      ({ chatId, newChatCreated, setSources: ss }) =>
        useChatHistory(chatId, newChatCreated, ss),
      { initialProps: { chatId: 'chat-1' as string | undefined, newChatCreated: false, setSources } },
    );

    await waitFor(() => {
      expect(setSources).toHaveBeenCalledWith(['web', 'academic']);
    }, { timeout: 3000 });
  });

  it('does not load when newChatCreated=true', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const { result } = renderHook(
      ({ chatId, newChatCreated, setSources }) =>
        useChatHistory(chatId, newChatCreated, setSources),
      { initialProps: { chatId: 'chat-1' as string | undefined, newChatCreated: true, setSources: vi.fn() } },
    );

    await act(async () => {});

    expect(result.current.isMessagesLoaded).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not reload when already loaded', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve(apiResponse()),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { result, rerender } = renderHook(
      ({ chatId, newChatCreated, setSources }) =>
        useChatHistory(chatId, newChatCreated, setSources),
      { initialProps: { chatId: 'chat-1' as string | undefined, newChatCreated: false, setSources: vi.fn() } },
    );

    await waitFor(() => {
      expect(result.current.isMessagesLoaded).toBe(true);
    }, { timeout: 3000 });

    const callCount = mockFetch.mock.calls.length;
    expect(callCount).toBeGreaterThanOrEqual(1);

    // Same chatId — should not fetch again
    rerender({ chatId: 'chat-1', newChatCreated: false, setSources: vi.fn() });

    expect(mockFetch.mock.calls.length).toBe(callCount);
  });

  it('resets state when chatId changes', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve(apiResponse()),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { result, rerender } = renderHook(
      ({ chatId, newChatCreated, setSources }) =>
        useChatHistory(chatId, newChatCreated, setSources),
      { initialProps: { chatId: 'chat-1' as string | undefined, newChatCreated: false, setSources: vi.fn() } },
    );

    await waitFor(() => {
      expect(result.current.isMessagesLoaded).toBe(true);
    }, { timeout: 3000 });
    expect(result.current.messages.length).toBeGreaterThan(0);

    // Change chatId — should trigger reset and new fetch
    rerender({ chatId: 'chat-2', newChatCreated: false, setSources: vi.fn() });

    await waitFor(() => {
      expect(result.current.isMessagesLoaded).toBe(true);
    }, { timeout: 3000 });

    expect(mockFetch).toHaveBeenCalledWith('/api/chats/chat-2', expect.anything());
  });

  it('updates messagesRef when messages change', async () => {
    const msgs = [makeMessage()];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        json: () => Promise.resolve(apiResponse({ messages: msgs })),
      }),
    );

    const { result } = renderHook(
      ({ chatId, newChatCreated, setSources }) =>
        useChatHistory(chatId, newChatCreated, setSources),
      { initialProps: { chatId: 'chat-1' as string | undefined, newChatCreated: false, setSources: vi.fn() } },
    );

    await waitFor(() => {
      expect(result.current.isMessagesLoaded).toBe(true);
    }, { timeout: 3000 });

    expect(result.current.messagesRef.current).toEqual(result.current.messages);
  });

  it('handles multiple messages in response', async () => {
    const msgs = [
      makeMessage({ query: 'first q', messageId: 'msg-1', responseBlocks: [textBlock('first a')] }),
      makeMessage({ query: 'second q', messageId: 'msg-2', responseBlocks: [textBlock('second a')] }),
      makeMessage({ query: 'third q', messageId: 'msg-3', responseBlocks: [textBlock('third a')] }),
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        json: () => Promise.resolve(apiResponse({ messages: msgs })),
      }),
    );

    const { result } = renderHook(
      ({ chatId, newChatCreated, setSources }) =>
        useChatHistory(chatId, newChatCreated, setSources),
      { initialProps: { chatId: 'chat-1' as string | undefined, newChatCreated: false, setSources: vi.fn() } },
    );

    await waitFor(() => {
      expect(result.current.isMessagesLoaded).toBe(true);
    }, { timeout: 3000 });

    expect(result.current.messages).toHaveLength(3);
    expect(result.current.chatHistory.current).toEqual([
      ['human', 'first q'],
      ['assistant', 'first a'],
      ['human', 'second q'],
      ['assistant', 'second a'],
      ['human', 'third q'],
      ['assistant', 'third a'],
    ]);
  });

  it('skips assistant entry when message has no text blocks', async () => {
    const msgs = [
      makeMessage({ query: 'hello', responseBlocks: [] }),
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        json: () => Promise.resolve(apiResponse({ messages: msgs })),
      }),
    );

    const { result } = renderHook(
      ({ chatId, newChatCreated, setSources }) =>
        useChatHistory(chatId, newChatCreated, setSources),
      { initialProps: { chatId: 'chat-1' as string | undefined, newChatCreated: false, setSources: vi.fn() } },
    );

    await waitFor(() => {
      expect(result.current.isMessagesLoaded).toBe(true);
    }, { timeout: 3000 });

    // Only the human entry; no assistant entry because no text blocks
    expect(result.current.chatHistory.current).toEqual([
      ['human', 'hello'],
    ]);

  });

  it('handles empty messages response without setting document.title', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        json: () => Promise.resolve(apiResponse({ messages: [] })),
      }),
    );
    document.title = 'original';

    const { result } = renderHook(
      ({ chatId, newChatCreated, setSources }) =>
        useChatHistory(chatId, newChatCreated, setSources),
      { initialProps: { chatId: 'chat-1' as string | undefined, newChatCreated: false, setSources: vi.fn() } },
    );

    await waitFor(() => {
      expect(result.current.isMessagesLoaded).toBe(true);
    }, { timeout: 3000 });

    expect(result.current.messages).toEqual([]);
    expect(result.current.chatHistory.current).toEqual([]);
    // document.title should NOT change when there are no messages
    expect(document.title).toBe('original');
  });
});
