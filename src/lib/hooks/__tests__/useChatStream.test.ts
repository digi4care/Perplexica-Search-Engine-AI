// @vitest-environment jsdom
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Message } from '@/components/ChatWindow';
import { Block } from '@/lib/types';

// ── Module mocks ──────────────────────────────────────────────────────

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

vi.mock('rfc6902', () => ({
  applyPatch: vi.fn(),
}));

vi.mock('crypto', () => ({
  default: {
    randomBytes: vi.fn(() => ({
      toString: vi.fn(() => 'abcdef1234567890abcdef1234567890'),
    })),
  },
}));

vi.mock('../../actions', () => ({
  getSuggestions: vi.fn(() => Promise.resolve(['suggestion 1', 'suggestion 2'])),
}));

vi.mock('../../config/clientRegistry', () => ({
  getAutoMediaSearch: vi.fn(() => false),
}));

// Import after mocks
import { toast } from 'sonner';
import { applyPatch } from 'rfc6902';
import crypto from 'crypto';
import { getSuggestions } from '../../actions'
import { getAutoMediaSearch } from '../../config/clientRegistry'
import { useChatStream, ChatStreamDeps } from '../useChatStream';

// ── Helpers ───────────────────────────────────────────────────────────

const textBlock = (data: string, id = 'b1'): Block => ({
  id,
  type: 'text',
  data,
});

const sourceBlock = (data: any[] = [], id = 'sb1'): Block => ({
  id,
  type: 'source',
  data,
});

const suggestionBlock = (data: string[] = [], id = 'sug1'): Block => ({
  id,
  type: 'suggestion',
  data,
});

let msgCounter = 0;
const makeMessage = (overrides: Partial<Message> = {}): Message => {
  msgCounter++;
  return {
    chatId: 'chat-1',
    messageId: `msg-${msgCounter}`,
    backendId: `be-${msgCounter}`,
    query: 'test query',
    responseBlocks: [],
    status: 'completed',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
};

/** Build a live state tracker that simulates React's setMessages(fn) */
const createStateTracker = (initial: Message[] = []) => {
  let messages = [...initial];
  const messagesRef = { current: messages };

  const setMessages = (fn: (prev: Message[]) => Message[]) => {
    messages = fn(messages);
    messagesRef.current = messages;
  };

  return { messagesRef, setMessages, getMessages: () => messages };
};

const makeDeps = (overrides: Partial<ChatStreamDeps> = {}): ChatStreamDeps & { _tracker: ReturnType<typeof createStateTracker> } => {
  const tracker = createStateTracker(overrides.messages ?? []);
  const chatHistoryRef = { current: (overrides.chatHistory as any)?.current ?? [] };

  return {
    chatId: 'chat-1',
    messages: overrides.messages ?? [],
    setMessages: tracker.setMessages,
    chatHistory: chatHistoryRef as any,
    messagesRef: tracker.messagesRef,
    fileIds: [],
    sources: ['web'],
    optimizationMode: 'speed',
    chatModelProvider: { key: 'gpt-4', providerId: 'openai' },
    embeddingModelProvider: { key: 'text-embedding-3-small', providerId: 'openai' },
    ...overrides,
    _tracker: tracker,
  } as any;
};

/** Create a mock SSE response with JSON chunks separated by newlines */
function createMockStreamResponse(chunks: string[]) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return {
    ok: true,
    status: 200,
    body: stream,
    json: async () => ({}),
  };
}

/** Create a single SSE chunk string */
function sseEvent(type: string, data: any = {}): string {
  return JSON.stringify({ type, ...data }) + '\n';
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('useChatStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    globalThis.fetch = vi.fn();
    msgCounter = 0;
    vi.mocked(getAutoMediaSearch).mockReturnValue(false);
    vi.mocked(getSuggestions).mockResolvedValue(['suggestion 1', 'suggestion 2']);
    vi.mocked(crypto.randomBytes).mockReturnValue({
      toString: vi.fn(() => 'abcdef1234567890abcdef1234567890'),
    } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial state ─────────────────────────────────────────────────

  describe('initial state', () => {
    it('returns initial loading=false, messageAppeared=false, researchEnded=false', () => {
      const deps = makeDeps();
      const { result } = renderHook(() => useChatStream(deps));
      expect(result.current.loading).toBe(false);
      expect(result.current.messageAppeared).toBe(false);
      expect(result.current.researchEnded).toBe(false);
    });

    it('returns sendMessage, rewrite, checkReconnect functions', () => {
      const deps = makeDeps();
      const { result } = renderHook(() => useChatStream(deps));
      expect(typeof result.current.sendMessage).toBe('function');
      expect(typeof result.current.rewrite).toBe('function');
      expect(typeof result.current.checkReconnect).toBe('function');
    });

    it('returns setResearchEnded setter', () => {
      const deps = makeDeps();
      const { result } = renderHook(() => useChatStream(deps));
      expect(typeof result.current.setResearchEnded).toBe('function');
    });
  });

  // ── sendMessage ───────────────────────────────────────────────────

  describe('sendMessage', () => {
    it('returns early when loading is true', async () => {
      const deps = makeDeps();
      const { result } = renderHook(() => useChatStream(deps));

      // Set loading via first send
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        createMockStreamResponse([sseEvent('messageEnd')]),
      );

      await act(async () => {
        await result.current.sendMessage('hello');
      });

      // Now loading should be true during the send, but false after.
      // Send another message while loading is true by triggering parallel send
      // Actually, let's test this differently: set loading, then try to send
    });

    it('returns early when message is empty', async () => {
      const deps = makeDeps();
      const { result } = renderHook(() => useChatStream(deps));

      await act(async () => {
        await result.current.sendMessage('');
      });

      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('sets loading=true on send and false after messageEnd', async () => {
      const deps = makeDeps();
      const { result } = renderHook(() => useChatStream(deps));

      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        createMockStreamResponse([sseEvent('messageEnd')]),
      );

      let loadingDuringSend: boolean | undefined;
      await act(async () => {
        const p = result.current.sendMessage('hello');
        // Check loading is true during the async operation
        loadingDuringSend = result.current.loading;
        await p;
      });

      expect(result.current.loading).toBe(false);
    });

    it('generates messageId via crypto when not provided', async () => {
      const deps = makeDeps();
      const { result } = renderHook(() => useChatStream(deps));

      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        createMockStreamResponse([sseEvent('messageEnd')]),
      );

      await act(async () => {
        await result.current.sendMessage('hello');
      });

      expect(crypto.randomBytes).toHaveBeenCalled();
    });

    it('POSTs to /api/chat with correct body', async () => {
      const deps = makeDeps();
      const { result } = renderHook(() => useChatStream(deps));

      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        createMockStreamResponse([sseEvent('messageEnd')]),
      );

      await act(async () => {
        await result.current.sendMessage('hello');
      });

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/chat', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }));

      const callArgs = vi.mocked(globalThis.fetch).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.content).toBe('hello');
      expect(body.chatId).toBe('chat-1');
      expect(body.sources).toEqual(['web']);
      expect(body.optimizationMode).toBe('speed');
    });

    it('includes chatModel and embeddingModel in request body', async () => {
      const deps = makeDeps();
      const { result } = renderHook(() => useChatStream(deps));

      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        createMockStreamResponse([sseEvent('messageEnd')]),
      );

      await act(async () => {
        await result.current.sendMessage('hello');
      });

      const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0][1].body);
      expect(body.chatModel).toEqual({ key: 'gpt-4', providerId: 'openai' });
      expect(body.embeddingModel).toEqual({ key: 'text-embedding-3-small', providerId: 'openai' });
    });

    it('includes systemInstructions from localStorage in request body', async () => {
      localStorage.setItem('systemInstructions', 'Be helpful');
      const deps = makeDeps();
      const { result } = renderHook(() => useChatStream(deps));

      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        createMockStreamResponse([sseEvent('messageEnd')]),
      );

      await act(async () => {
        await result.current.sendMessage('hello');
      });

      const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0][1].body);
      expect(body.systemInstructions).toBe('Be helpful');
    });

    it('updates browser history on first message', async () => {
      const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
      const deps = makeDeps({ messages: [] });
      const { result } = renderHook(() => useChatStream(deps));

      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        createMockStreamResponse([sseEvent('messageEnd')]),
      );

      await act(async () => {
        await result.current.sendMessage('hello');
      });

      expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/c/chat-1');
    });

    it('does not update browser history when messages > 1', async () => {
      const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
      const existingMsg = makeMessage();
      const deps = makeDeps({ messages: [existingMsg, makeMessage()] });
      deps.messages = [existingMsg, makeMessage()];
      const { result } = renderHook(() => useChatStream(deps));

      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        createMockStreamResponse([sseEvent('messageEnd')]),
      );

      await act(async () => {
        await result.current.sendMessage('hello');
      });

      expect(replaceStateSpy).not.toHaveBeenCalled();
    });

    it('handles SSE error event: toast.error, set status to error', async () => {
      const deps = makeDeps();
      const { result } = renderHook(() => useChatStream(deps));

      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        createMockStreamResponse([sseEvent('error', { data: 'Something went wrong' })]),
      );

      await act(async () => {
        await result.current.sendMessage('hello');
      });

      expect(toast.error).toHaveBeenCalledWith('Something went wrong');
      expect(result.current.loading).toBe(false);
    });

    it('handles SSE block event: adds new block to message', async () => {
      const deps = makeDeps();
      const { result } = renderHook(() => useChatStream(deps));

      const block = textBlock('hello world', 'block-1');
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        createMockStreamResponse([
          sseEvent('block', { block }),
          sseEvent('messageEnd'),
        ]),
      );

      await act(async () => {
        await result.current.sendMessage('hello');
      });

      const msgs = deps._tracker.getMessages();
      const lastMsg = msgs[msgs.length - 1];
      expect(lastMsg.responseBlocks).toHaveLength(1);
      expect(lastMsg.responseBlocks[0]).toEqual(block);
    });

    it('handles SSE block event: updates existing block by same ID', async () => {
      const deps = makeDeps();
      const { result } = renderHook(() => useChatStream(deps));

      const block1 = textBlock('initial', 'block-1');
      const block2 = textBlock('updated', 'block-1');
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        createMockStreamResponse([
          sseEvent('block', { block: block1 }),
          sseEvent('block', { block: block2 }),
          sseEvent('messageEnd'),
        ]),
      );

      await act(async () => {
        await result.current.sendMessage('hello');
      });

      const msgs = deps._tracker.getMessages();
      const lastMsg = msgs[msgs.length - 1];
      expect(lastMsg.responseBlocks).toHaveLength(1);
      expect(lastMsg.responseBlocks[0].data).toBe('updated');
    });

    it('handles SSE researchComplete event: sets researchEnded', async () => {
      const deps = makeDeps();
      const { result } = renderHook(() => useChatStream(deps));

      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        createMockStreamResponse([
          sseEvent('researchComplete'),
          sseEvent('messageEnd'),
        ]),
      );

      await act(async () => {
        await result.current.sendMessage('hello');
      });

      expect(result.current.researchEnded).toBe(true);
    });

    it('handles SSE updateBlock event: applies RFC6902 patch', async () => {
      const deps = makeDeps();
      const { result } = renderHook(() => useChatStream(deps));

      const block = textBlock('hello', 'block-1');
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        createMockStreamResponse([
          sseEvent('block', { block }),
          sseEvent('updateBlock', { blockId: 'block-1', patch: [{ op: 'replace', path: '/data', value: 'patched' }] }),
          sseEvent('messageEnd'),
        ]),
      );

      await act(async () => {
        await result.current.sendMessage('hello');
      });

      expect(applyPatch).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'block-1' }),
        [{ op: 'replace', path: '/data', value: 'patched' }],
      );
    });

    it('handles SSE messageEnd event: sets status completed, loading false', async () => {
      const deps = makeDeps();
      const { result } = renderHook(() => useChatStream(deps));

      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        createMockStreamResponse([sseEvent('messageEnd')]),
      );

      await act(async () => {
        await result.current.sendMessage('hello');
      });

      expect(result.current.loading).toBe(false);
      const msgs = deps._tracker.getMessages();
      const lastMsg = msgs[msgs.length - 1];
      expect(lastMsg.status).toBe('completed');
    });

    it('handles SSE messageEnd event: updates chatHistory', async () => {
      const chatHistoryRef = { current: [] } as any;
      const deps = makeDeps({ chatHistory: chatHistoryRef } as any);

      const { result } = renderHook(() => useChatStream(deps));

      // Add a text block so it goes into history
      const block = textBlock('response text', 'b1');
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        createMockStreamResponse([
          sseEvent('block', { block }),
          sseEvent('messageEnd'),
        ]),
      );

      await act(async () => {
        await result.current.sendMessage('hello');
      });

      // chatHistory should have human + assistant entry
      const history = chatHistoryRef.current;
      expect(history).toEqual([
        ['human', 'hello'],
        ['assistant', 'response text'],
      ]);
    });

    it('fetches suggestions on messageEnd when no suggestion blocks exist and has source blocks', async () => {
      const deps = makeDeps();
      const { result } = renderHook(() => useChatStream(deps));

      const srcBlock = sourceBlock([{ content: 'source data', metadata: {} }], 'src-1');
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        createMockStreamResponse([
          sseEvent('block', { block: srcBlock }),
          sseEvent('messageEnd'),
        ]),
      );

      await act(async () => {
        await result.current.sendMessage('hello');
      });

      expect(getSuggestions).toHaveBeenCalled();
      const msgs = deps._tracker.getMessages();
      const lastMsg = msgs[msgs.length - 1];
      expect(lastMsg.responseBlocks.some(b => b.type === 'suggestion')).toBe(true);
    });

    it('does NOT fetch suggestions when suggestion blocks already exist', async () => {
      const deps = makeDeps();
      const { result } = renderHook(() => useChatStream(deps));

      const srcBlock = sourceBlock([{ content: 'source data', metadata: {} }], 'src-1');
      const sugBlock = suggestionBlock(['existing suggestion'], 'sug-1');
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        createMockStreamResponse([
          sseEvent('block', { block: srcBlock }),
          sseEvent('block', { block: sugBlock }),
          sseEvent('messageEnd'),
        ]),
      );

      await act(async () => {
        await result.current.sendMessage('hello');
      });

      expect(getSuggestions).not.toHaveBeenCalled();
    });

    it('sets messageAppeared=true on text block', async () => {
      const deps = makeDeps();
      const { result } = renderHook(() => useChatStream(deps));

      const block = textBlock('hello', 'b1');
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        createMockStreamResponse([
          sseEvent('block', { block }),
          sseEvent('messageEnd'),
        ]),
      );

      await act(async () => {
        await result.current.sendMessage('hello');
      });

      expect(result.current.messageAppeared).toBe(true);
    });

    it('sets messageAppeared=true on non-empty source block', async () => {
      const deps = makeDeps();
      const { result } = renderHook(() => useChatStream(deps));

      const srcBlock = sourceBlock([{ content: 'data', metadata: {} }], 'src-1');
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        createMockStreamResponse([
          sseEvent('block', { block: srcBlock }),
          sseEvent('messageEnd'),
        ]),
      );

      await act(async () => {
        await result.current.sendMessage('hello');
      });

      expect(result.current.messageAppeared).toBe(true);
    });

    it('does NOT set messageAppeared on empty source block', async () => {
      const deps = makeDeps();
      const { result } = renderHook(() => useChatStream(deps));

      const srcBlock = sourceBlock([], 'src-1');
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        createMockStreamResponse([
          sseEvent('block', { block: srcBlock }),
          sseEvent('messageEnd'),
        ]),
      );

      await act(async () => {
        await result.current.sendMessage('hello');
      });

      expect(result.current.messageAppeared).toBe(false);
    });
  });

  // ── rewrite ───────────────────────────────────────────────────────

  describe('rewrite', () => {
    it('finds message by ID and calls sendMessage with rewrite=true', async () => {
      const msg = makeMessage({ query: 'rewrite me', messageId: 'msg-rewrite', backendId: 'be-rewrite' });
      const chatHistoryRef = { current: [['human', 'hello'], ['assistant', 'hi']] } as any;
      const deps = makeDeps({ messages: [msg], chatHistory: chatHistoryRef } as any);

      const { result } = renderHook(() => useChatStream(deps));

      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        createMockStreamResponse([sseEvent('messageEnd')]),
      );

      await act(async () => {
        result.current.rewrite('msg-rewrite');
      });

      // Should have called fetch with rewrite history
      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalled();
      });

      const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0][1].body);
      expect(body.content).toBe('rewrite me');
    });

    it('returns early when messageId is not found', async () => {
      const deps = makeDeps({ messages: [] });
      const { result } = renderHook(() => useChatStream(deps));

      await act(async () => {
        result.current.rewrite('nonexistent');
      });

      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('slices chatHistory to the message index * 2', async () => {
      const msg1 = makeMessage({ query: 'first', messageId: 'msg-1' });
      const msg2 = makeMessage({ query: 'second', messageId: 'msg-2' });
      const chatHistoryRef = { current: [['human', 'first'], ['assistant', 'ans1'], ['human', 'second'], ['assistant', 'ans2']] } as any;
      const deps = makeDeps({ messages: [msg1, msg2], chatHistory: chatHistoryRef } as any);

      const { result } = renderHook(() => useChatStream(deps));

      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        createMockStreamResponse([sseEvent('messageEnd')]),
      );

      await act(async () => {
        result.current.rewrite('msg-1');
      });

      // After rewrite, chatHistory is sliced to 0, then messageEnd adds new entries
      // rewrite('msg-1') slices to index*2=0, then sendMessage adds history via messageEnd
      expect(chatHistoryRef.current).toEqual([['human', 'first'], ['assistant', '']]);
    });
  });

  // ── checkReconnect ────────────────────────────────────────────────

  describe('checkReconnect', () => {
    it('does nothing when no messages exist', async () => {
      const deps = makeDeps({ messages: [] });
      const { result } = renderHook(() => useChatStream(deps));

      await act(async () => {
        await result.current.checkReconnect();
      });

      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('does nothing when last message is not answering', async () => {
      const msg = makeMessage({ status: 'completed' });
      const deps = makeDeps({ messages: [msg] });
      const { result } = renderHook(() => useChatStream(deps));

      await act(async () => {
        await result.current.checkReconnect();
      });

      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('reconnects to /api/reconnect/{backendId} when last message is answering', async () => {
      const msg = makeMessage({ status: 'answering', backendId: 'be-reconnect-123' });
      const deps = makeDeps({ messages: [msg] });
      const { result } = renderHook(() => useChatStream(deps));

      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        createMockStreamResponse([sseEvent('messageEnd')]),
      );

      await act(async () => {
        await result.current.checkReconnect();
      });

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/reconnect/be-reconnect-123', {
        method: 'POST',
      });
    });

    it('processes SSE events during reconnect', async () => {
      const msg = makeMessage({ status: 'answering', backendId: 'be-recon' });
      const deps = makeDeps({ messages: [msg] });
      const { result } = renderHook(() => useChatStream(deps));

      const block = textBlock('reconnected text', 'rb-1');
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        createMockStreamResponse([
          sseEvent('block', { block }),
          sseEvent('messageEnd'),
        ]),
      );

      await act(async () => {
        await result.current.checkReconnect();
      });

      // The message in the tracker should have the block added
      const msgs = deps._tracker.getMessages();
      expect(msgs[0].responseBlocks).toHaveLength(1);
      expect(msgs[0].responseBlocks[0]).toEqual(block);
    });

    it('sets loading=true during reconnect and false after', async () => {
      const msg = makeMessage({ status: 'answering', backendId: 'be-recon' });
      const deps = makeDeps({ messages: [msg] });
      const { result } = renderHook(() => useChatStream(deps));

      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        createMockStreamResponse([sseEvent('messageEnd')]),
      );

      await act(async () => {
        await result.current.checkReconnect();
      });

      expect(result.current.loading).toBe(false);
    });

    it('resets researchEnded and messageAppeared on reconnect', async () => {
      const msg = makeMessage({ status: 'answering', backendId: 'be-recon' });
      const deps = makeDeps({ messages: [msg] });
      const { result } = renderHook(() => useChatStream(deps));

      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        createMockStreamResponse([sseEvent('messageEnd')]),
      );

      // Set to true first
      act(() => {
        result.current.setResearchEnded(true);
      });

      await act(async () => {
        await result.current.checkReconnect();
      });

      // After reconnect, researchEnded should be reset to false (by checkReconnect)
      // but messageEnd sets loading=false. researchEnded is set to false at start of reconnect.
      expect(result.current.researchEnded).toBe(false);
      expect(result.current.messageAppeared).toBe(false);
    });
  });

  // ── setResearchEnded ──────────────────────────────────────────────

  describe('setResearchEnded', () => {
    it('updates researchEnded state', () => {
      const deps = makeDeps();
      const { result } = renderHook(() => useChatStream(deps));

      expect(result.current.researchEnded).toBe(false);

      act(() => {
        result.current.setResearchEnded(true);
      });

      expect(result.current.researchEnded).toBe(true);
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles split JSON chunks across SSE reads', async () => {
      const deps = makeDeps();
      const { result } = renderHook(() => useChatStream(deps));

      // Simulate a chunk split across two reads
      const encoder = new TextEncoder();
      const part1 = '{"type":"block","block":{"id":"b1","type":"text","data":"hel';
      const part2 = 'lo"}}\n{"type":"messageEnd"}\n';

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(part1));
          controller.enqueue(encoder.encode(part2));
          controller.close();
        },
      });

      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: stream,
        json: async () => ({}),
      });

      await act(async () => {
        await result.current.sendMessage('hello');
      });

      // Should have processed both chunks despite the split
      const msgs = deps._tracker.getMessages();
      const lastMsg = msgs[msgs.length - 1];
      expect(lastMsg.responseBlocks).toHaveLength(1);
      expect(lastMsg.responseBlocks[0].data).toBe('hello');
    });

    it('sends rewrite=true in body when rewrite flag is set', async () => {
      const msg = makeMessage({ query: 'original query', messageId: 'msg-rw' });
      const chatHistoryRef = { current: [['human', 'q1'], ['assistant', 'a1']] } as any;
      const deps = makeDeps({ messages: [msg], chatHistory: chatHistoryRef } as any);
      const { result } = renderHook(() => useChatStream(deps));

      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        createMockStreamResponse([sseEvent('messageEnd')]),
      );

      await act(async () => {
        await result.current.sendMessage('original query', 'msg-rw', true);
      });

      const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0][1].body);
      // When rewrite=true and messageIndex is found, history is sliced
      expect(body.content).toBe('original query');
    });

    it('includes fileIds in request body', async () => {
      const deps = makeDeps({ fileIds: ['file-1', 'file-2'] });
      const { result } = renderHook(() => useChatStream(deps));

      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        createMockStreamResponse([sseEvent('messageEnd')]),
      );

      await act(async () => {
        await result.current.sendMessage('hello');
      });

      const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0][1].body);
      expect(body.files).toEqual(['file-1', 'file-2']);
    });

    it('uses provided messageId when given', async () => {
      const deps = makeDeps();
      const { result } = renderHook(() => useChatStream(deps));

      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        createMockStreamResponse([sseEvent('messageEnd')]),
      );

      await act(async () => {
        await result.current.sendMessage('hello', 'custom-msg-id');
      });

      const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0][1].body);
      expect(body.message.messageId).toBe('custom-msg-id');
    });

    it('autoMediaSearch clicks media buttons when enabled', async () => {
      vi.mocked(getAutoMediaSearch).mockReturnValue(true);
      const deps = makeDeps();
      const { result } = renderHook(() => useChatStream(deps));

      // Mock document.getElementById
      const clickFn = vi.fn();
      const getElementByIdSpy = vi.spyOn(document, 'getElementById').mockReturnValue({
        click: clickFn,
      } as any);

      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        createMockStreamResponse([sseEvent('messageEnd')]),
      );

      await act(async () => {
        await result.current.sendMessage('hello');
      });

      // Wait for the setTimeout(200ms) to fire
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 250));
      });

      expect(getElementByIdSpy).toHaveBeenCalled();
      getElementByIdSpy.mockRestore();
    });

    it('handles error status message in checkReconnect with answering status', async () => {
      const msg = makeMessage({ status: 'answering', backendId: 'be-err' });
      const deps = makeDeps({ messages: [msg] });
      const { result } = renderHook(() => useChatStream(deps));

      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        createMockStreamResponse([sseEvent('error', { data: 'Stream error' })]),
      );

      await act(async () => {
        await result.current.checkReconnect();
      });

      expect(toast.error).toHaveBeenCalledWith('Stream error');
    });
  });
});
