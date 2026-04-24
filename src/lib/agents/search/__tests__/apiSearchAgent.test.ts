import { describe, it, expect, vi, beforeEach } from 'vitest';
import APISearchAgent from '@/lib/agents/search/api';
import type { SearchSession } from '@/lib/ports';
import type { SearchAgentInput, ClassifierOutput } from '@/lib/agents/search/types';
import { createMockSession } from '@/lib/__tests__/fixtures';

// --- Shared stubs ---

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
      return (async function* () {
        yield { contentChunk: 'API response chunk', toolCallChunk: [] };
      })();
    }),
  };
}

function createBaseInput(overrides?: Partial<SearchAgentInput>): SearchAgentInput {
  return {
    chatId: 'chat-1',
    messageId: 'msg-1',
    followUp: 'What is AI?',
    chatHistory: [],
    config: {
      sources: ['web'],
      fileIds: [],
      llm: createMockLlm() as any,
      embedding: {} as any,
      searchBackend: {} as any,
      mode: 'speed',
      systemInstructions: '',
    },
    ...overrides,
  };
}

// --- Tests ---

describe('APISearchAgent', () => {
  it('accepts a session factory via constructor', () => {
    const factory = vi.fn().mockReturnValue(createMockSession('research-sess'));
    const agent = new APISearchAgent(factory);
    expect(agent).toBeInstanceOf(APISearchAgent);
  });

  it('calls the session factory to create a researcher session', async () => {
    const researchSession = createMockSession('research-sess');
    const factory = vi.fn().mockReturnValue(researchSession);
    const agent = new APISearchAgent(factory);

    const mainSession = createMockSession('main-sess');
    const input = createBaseInput();

    await agent.searchAsync(mainSession, input);

    // Factory should be called to create researcher session
    expect(factory).toHaveBeenCalled();
  });

  it('emits searchResults and researchComplete on the main session', async () => {
    const researchSession = createMockSession('research-sess');
    const factory = vi.fn().mockReturnValue(researchSession);
    const agent = new APISearchAgent(factory);

    const mainSession = createMockSession('main-sess');
    const input = createBaseInput();

    await agent.searchAsync(mainSession, input);

    const dataEvents = mainSession.getEventsByType('data');
    const types = dataEvents.map((e) => (e.data as Record<string, unknown>).type);

    expect(types).toContain('researchComplete');
  });

  it('emits response chunks from streamText on the main session', async () => {
    const factory = vi.fn().mockReturnValue(createMockSession('research-sess'));
    const agent = new APISearchAgent(factory);

    const mainSession = createMockSession('main-sess');
    const input = createBaseInput();

    await agent.searchAsync(mainSession, input);

    const dataEvents = mainSession.getEventsByType('data');
    const responseEvents = dataEvents.filter((e) => (e.data as Record<string, unknown>).type === 'response');

    expect(responseEvents.length).toBeGreaterThan(0);
    expect((responseEvents[0].data as Record<string, unknown>).data).toBe('API response chunk');
  });

  it('emits end event when done', async () => {
    const factory = vi.fn().mockReturnValue(createMockSession('research-sess'));
    const agent = new APISearchAgent(factory);

    const mainSession = createMockSession('main-sess');
    const input = createBaseInput();

    await agent.searchAsync(mainSession, input);

    const endEvents = mainSession.getEventsByType('end');
    expect(endEvents).toHaveLength(1);
  });
});
