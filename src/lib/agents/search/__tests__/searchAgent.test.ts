import { describe, it, expect, vi, beforeEach } from 'vitest';
import SearchAgent from '@/lib/agents/search';
import type { MessageStore } from '@/lib/ports';
import type { SearchAgentInput, ClassifierOutput } from '@/lib/agents/search/types';
import { createMockSession } from '@/lib/__tests__/fixtures';

// --- Shared stubs ---

function createMockMessageStore(): MessageStore {
  return {
    findMessage: vi.fn().mockResolvedValue(undefined),
    insertMessage: vi.fn().mockResolvedValue(undefined),
    deleteMessagesAfter: vi.fn().mockResolvedValue(undefined),
    updateMessage: vi.fn().mockResolvedValue(undefined),
  };
}

const defaultClassification: ClassifierOutput = {
  classification: {
    skipSearch: false,
    personalSearch: false,
    academicSearch: false,
    discussionSearch: false,
    showWeatherWidget: false,
    showStockWidget: false,
    showCalculationWidget: false,
  },
  standaloneFollowUp: 'test query',
};

function createMockLlm(classification?: ClassifierOutput) {
  const cls = classification ?? defaultClassification;
  return {
    generateObject: vi.fn().mockResolvedValue(cls),
    streamText: vi.fn().mockImplementation(() => {
      // Default: empty async generator (no content chunks)
      return (async function* () {
        yield { contentChunk: 'Hello', toolCallChunk: [] };
      })();
    }),
  };
}

function createBaseInput(overrides?: Partial<SearchAgentInput>): SearchAgentInput {
  return {
    chatId: 'chat-1',
    messageId: 'msg-1',
    followUp: 'What is the weather?',
    chatHistory: [],
    config: {
      sources: ['web'],
      fileIds: [],
      llm: createMockLlm() as any,
      embedding: {} as any,
      searchBackend: {} as any,
      mode: 'balanced',
      systemInstructions: '',
    },
    ...overrides,
  };
}

// --- Tests ---

describe('SearchAgent', () => {
  let messageStore: MessageStore;
  let agent: SearchAgent;

  beforeEach(() => {
    messageStore = createMockMessageStore();
    agent = new SearchAgent(messageStore);
  });

  it('accepts MessageStore via constructor', () => {
    expect(agent).toBeInstanceOf(SearchAgent);
  });

  describe('searchAsync — new message', () => {
    it('calls insertMessage when no existing message found', async () => {
      const session = createMockSession('sess-1');
      const input = createBaseInput();

      await agent.searchAsync(session, input);

      expect(messageStore.findMessage).toHaveBeenCalledWith({
        chatId: 'chat-1',
        messageId: 'msg-1',
      });
      expect(messageStore.insertMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          chatId: 'chat-1',
          messageId: 'msg-1',
          status: 'answering',
          responseBlocks: [],
        }),
      );
      expect(messageStore.deleteMessagesAfter).not.toHaveBeenCalled();
    });
  });

  describe('searchAsync — existing message', () => {
    it('calls deleteMessagesAfter + updateMessage when message exists', async () => {
      (messageStore.findMessage as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 42,
        chatId: 'chat-1',
        messageId: 'msg-1',
        status: 'completed',
      });

      const session = createMockSession('sess-1');
      const input = createBaseInput();

      await agent.searchAsync(session, input);

      expect(messageStore.deleteMessagesAfter).toHaveBeenCalledWith('chat-1', 42);
      expect(messageStore.updateMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          chatId: 'chat-1',
          messageId: 'msg-1',
          status: 'answering',
        }),
      );
      expect(messageStore.insertMessage).not.toHaveBeenCalled();
    });
  });

  describe('searchAsync — completion', () => {
    it('calls updateMessage with completed status at the end', async () => {
      const session = createMockSession('sess-1');
      const input = createBaseInput();

      await agent.searchAsync(session, input);

      // The final updateMessage call should have status 'completed'
      const updateCalls = (messageStore.updateMessage as ReturnType<typeof vi.fn>).mock.calls;
      const lastCall = updateCalls[updateCalls.length - 1];
      expect(lastCall[0]).toEqual(
        expect.objectContaining({
          chatId: 'chat-1',
          messageId: 'msg-1',
          status: 'completed',
        }),
      );
    });

    it('emits end event on session', async () => {
      const session = createMockSession('sess-1');
      const input = createBaseInput();

      await agent.searchAsync(session, input);

      const endEvents = session.getEventsByType('end');
      expect(endEvents).toHaveLength(1);
    });
  });

  describe('searchAsync — skipSearch', () => {
    it('does not invoke researcher when classification skips search', async () => {
      const skipClassification: ClassifierOutput = {
        classification: {
          ...defaultClassification.classification,
          skipSearch: true,
        },
        standaloneFollowUp: 'test query',
      };

      const llm = createMockLlm(skipClassification);
      const session = createMockSession('sess-1');
      const input = createBaseInput({
        config: {
          ...createBaseInput().config,
          llm: llm as any,
        },
      });

      await agent.searchAsync(session, input);

      // With skipSearch, the writer still runs but no research blocks appear
      // The final context should indicate no search was made
      const dataEvents = session.getEventsByType('data');
      const researchCompleteEvents = dataEvents.filter(
        (e) => (e.data as Record<string, unknown>).type === 'researchComplete',
      );
      expect(researchCompleteEvents).toHaveLength(1);
    });
  });
});
