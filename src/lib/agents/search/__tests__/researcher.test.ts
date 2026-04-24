import { describe, it, expect, vi, beforeEach } from 'vitest';
import Researcher from '@/lib/agents/search/researcher';
import type { SearchSession } from '@/lib/ports';
import type { ResearcherInput, ClassifierOutput } from '@/lib/agents/search/types';
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

/**
 * Creates an async generator that yields a single 'done' tool call.
 * This causes the researcher loop to exit after one iteration.
 */
async function* mockDoneStream() {
  yield {
    contentChunk: '',
    toolCallChunk: [
      {
        id: 'tc-1',
        name: 'done',
        arguments: {},
      },
    ],
  };
}

function createMockLlm() {
  return {
    generateObject: vi.fn().mockResolvedValue(defaultClassification),
    streamText: vi.fn().mockImplementation(() => mockDoneStream()),
  };
}

function createBaseInput(overrides?: Partial<ResearcherInput>): ResearcherInput {
  return {
    chatHistory: [],
    followUp: 'What is AI?',
    classification: defaultClassification,
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

describe('Researcher', () => {
  it('takes no constructor arguments', () => {
    const researcher = new Researcher();
    expect(researcher).toBeInstanceOf(Researcher);
  });

  it('creates a research block on the session', async () => {
    const session = createMockSession('research-sess');
    const researcher = new Researcher();
    const input = createBaseInput();

    await researcher.research(session, input);

    // Check that a research block was emitted
    const blocks = Array.from(session.getBlocks().values());
    const researchBlocks = blocks.filter((b: { type: string }) => b.type === 'research');
    expect(researchBlocks).toHaveLength(1);
    expect(researchBlocks[0].data).toHaveProperty('subSteps');
  });

  it('returns findings and searchFindings', async () => {
    const session = createMockSession('research-sess');
    const researcher = new Researcher();
    const input = createBaseInput();

    const result = await researcher.research(session, input);

    expect(result).toHaveProperty('findings');
    expect(result).toHaveProperty('searchFindings');
    expect(Array.isArray(result.findings)).toBe(true);
    expect(Array.isArray(result.searchFindings)).toBe(true);
  });

  it('returns empty searchFindings when no search actions execute', async () => {
    // When streamText only yields 'done', no search actions execute,
    // so searchFindings should be empty
    const session = createMockSession('research-sess');
    const researcher = new Researcher();
    const input = createBaseInput();

    const result = await researcher.research(session, input);

    expect(result.searchFindings).toEqual([]);
  });

  it('emits a source block with search findings', async () => {
    const session = createMockSession('research-sess');
    const researcher = new Researcher();
    const input = createBaseInput();

    await researcher.research(session, input);

    const blocks = Array.from(session.getBlocks().values());
    const sourceBlocks = blocks.filter((b: { type: string }) => b.type === 'source');
    expect(sourceBlocks).toHaveLength(1);
  });
});
