import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Chunk, ResearchBlock } from '@/lib/types';
import type {
  SearchBackend,
  EmbeddingModel,
  ChatModel,
  SearchSession,
} from '@/lib/ports';

// Mock external dependencies before imports
vi.mock('@/lib/scraper', () => ({
  default: { scrape: vi.fn() },
}));
vi.mock('@/lib/utils/splitText', () => ({
  splitText: vi.fn(),
}));

import { searchAndEmit, dedupResults } from '../researcher/actions/search/searchHelpers';
import { executeSpeedSearch } from '../researcher/actions/search/speedSearch';
import { executeQualitySearch } from '../researcher/actions/search/qualitySearch';
import { executeSearch } from '../researcher/actions/search/baseSearch';

import Scraper from '@/lib/scraper';
import { splitText } from '@/lib/utils/splitText';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function createMockSearchBackend(
  results: Array<{ title: string; url: string; content?: string }> = [],
) {
  return {
    search: vi.fn().mockResolvedValue({ results, suggestions: [] }),
  } as unknown as SearchBackend;
}

function createMockEmbedding(embeddings: number[][] = [[0.1, 0.2]]) {
  return {
    embedText: vi.fn().mockResolvedValue(embeddings),
  } as unknown as EmbeddingModel;
}

function createMockChatModel(response: Record<string, unknown> = {}) {
  return {
    generateObject: vi.fn().mockResolvedValue(response),
  } as unknown as ChatModel;
}

function createMockSession(): SearchSession {
  return {
    id: 'sess-1',
    emit: vi.fn(),
    emitBlock: vi.fn(),
    getBlock: vi.fn(),
    updateBlock: vi.fn(),
    getAllBlocks: vi.fn().mockReturnValue([]),
    subscribe: vi.fn().mockReturnValue(() => {}),
    removeAllListeners: vi.fn(),
  };
}

function createResearchBlock(): ResearchBlock {
  return {
    id: 'rb-1',
    type: 'research',
    data: { subSteps: [] },
  };
}

// ---------------------------------------------------------------------------
// searchAndEmit
// ---------------------------------------------------------------------------

describe('searchAndEmit', () => {
  let backend: SearchBackend;
  let embedding: EmbeddingModel;
  let session: SearchSession;
  let researchBlock: ResearchBlock;
  const searchResultsBlockId = 'srb-1';

  beforeEach(() => {
    backend = createMockSearchBackend([
      { title: 'Result A', url: 'https://a.com', content: 'Content A' },
      { title: 'Result B', url: 'https://b.com', content: 'Content B' },
    ]);
    session = createMockSession();
    researchBlock = createResearchBlock();
  });

  it('speed mode: embeds results and filters by similarity >0.5', async () => {
    // Sequential mock: query embed → [1,0], resultA embed → [1,0] (sim=1), resultB embed → [0,1] (sim=0)
    embedding = {
      embedText: vi.fn()
        .mockResolvedValueOnce([[1, 0]])
        .mockResolvedValueOnce([[1, 0]])
        .mockResolvedValueOnce([[0, 1]]),
    } as unknown as EmbeddingModel;

    const result = await searchAndEmit(
      'test query',
      'speed',
      undefined,
      embedding,
      backend,
      researchBlock,
      session,
      searchResultsBlockId,
      { value: false },
    );

    expect(result).toHaveLength(1);
    expect(result[0].metadata.title).toBe('Result A');
    expect(result[0].metadata.similarity).toBeGreaterThan(0.5);
  });

  it('speed mode with embedding failure: falls back to similarity 1', async () => {
    embedding = {
      embedText: vi.fn().mockRejectedValue(new Error('Embedding failed')),
    } as unknown as EmbeddingModel;

    const result = await searchAndEmit(
      'test query',
      'speed',
      undefined,
      embedding,
      backend,
      researchBlock,
      session,
      searchResultsBlockId,
      { value: false },
    );

    expect(result).toHaveLength(2);
    expect(result[0].metadata.similarity).toBe(1);
    expect(result[1].metadata.similarity).toBe(1);
  });

  it('quality mode: maps results without embedding', async () => {
    embedding = createMockEmbedding();

    const result = await searchAndEmit(
      'test query',
      'quality',
      undefined,
      embedding,
      backend,
      researchBlock,
      session,
      searchResultsBlockId,
      { value: false },
    );

    // quality mode should NOT call embedText
    expect(embedding.embedText).not.toHaveBeenCalled();
    expect(result).toHaveLength(2);
    expect(result[0].metadata.similarity).toBe(1);
    expect(result[0].content).toBe('Content A');
  });

  it('first emit creates new substep, second emit appends', async () => {
    embedding = createMockEmbedding([
      [1, 0], [1, 0], // first call
      [1, 0], [1, 0], // second call
    ]);

    const emitted = { value: false };

    // First call — should push a new substep
    await searchAndEmit(
      'query1', 'speed', undefined, embedding, backend,
      researchBlock, session, searchResultsBlockId, emitted,
    );

    expect(researchBlock.data.subSteps).toHaveLength(1);
    const firstSubStep = researchBlock.data.subSteps[0] as any;
    expect(firstSubStep.type).toBe('search_results');
    expect(firstSubStep.reading).toHaveLength(2);

    // Second call — should append to existing substep
    await searchAndEmit(
      'query2', 'speed', undefined, embedding, backend,
      researchBlock, session, searchResultsBlockId, emitted,
    );

    expect(researchBlock.data.subSteps).toHaveLength(1); // still 1 substep
    expect(firstSubStep.reading).toHaveLength(4); // 2 + 2 appended
  });

  it('uses content fallback to title when content is empty', async () => {
    backend = createMockSearchBackend([
      { title: 'Only Title', url: 'https://c.com', content: '' },
      { title: 'No Content Either', url: 'https://d.com' },
    ]);
    embedding = createMockEmbedding();

    const result = await searchAndEmit(
      'test', 'quality', undefined, embedding, backend,
      researchBlock, session, searchResultsBlockId, { value: false },
    );

    expect(result[0].content).toBe('Only Title');
    expect(result[1].content).toBe('No Content Either');
  });

  it('returns empty array when backend returns no results', async () => {
    backend = createMockSearchBackend([]);
    embedding = createMockEmbedding();

    const result = await searchAndEmit(
      'test', 'speed', undefined, embedding, backend,
      researchBlock, session, searchResultsBlockId, { value: false },
    );

    expect(result).toHaveLength(0);
  });

  it('passes searchConfig to backend', async () => {
    embedding = createMockEmbedding([[]]);
    backend = createMockSearchBackend([]);
    const config = { language: 'en' };

    await searchAndEmit(
      'test', 'quality', config as any, embedding, backend,
      researchBlock, session, searchResultsBlockId, { value: false },
    );

    expect(backend.search).toHaveBeenCalledWith('test', config);
  });
});

// ---------------------------------------------------------------------------
// dedupResults
// ---------------------------------------------------------------------------

describe('dedupResults', () => {
  it('deduplicates chunks with cosine similarity >0.75', () => {
    // Two nearly identical vectors
    const a: Chunk = {
      content: 'AAA',
      metadata: { title: 'A', url: 'https://a.com', similarity: 0.9, embedding: [1, 0, 0] },
    };
    const b: Chunk = {
      content: 'AAB',
      metadata: { title: 'B', url: 'https://b.com', similarity: 0.85, embedding: [0.99, 0.01, 0] },
    };
    const c: Chunk = {
      content: 'CCC',
      metadata: { title: 'C', url: 'https://c.com', similarity: 0.8, embedding: [0, 0, 1] },
    };

    const result = dedupResults([a, b, c]);

    // b is duplicate of a (cosine ~0.999 > 0.75), so only a and c remain
    expect(result).toHaveLength(2);
    expect(result[0].content).toBe('AAA');
    expect(result[1].content).toBe('CCC');
  });

  it('skips chunks with empty embeddings from dedup comparison', () => {
    const a: Chunk = {
      content: 'AAA',
      metadata: { title: 'A', url: 'https://a.com', similarity: 0.9, embedding: [1, 0, 0] },
    };
    const b: Chunk = {
      content: 'BBB',
      metadata: { title: 'B', url: 'https://b.com', similarity: 0.8, embedding: [] },
    };

    // b has empty embedding → skip comparison → both should be kept
    const result = dedupResults([a, b]);

    expect(result).toHaveLength(2);
  });

  it('removes embedding and similarity from metadata', () => {
    const a: Chunk = {
      content: 'AAA',
      metadata: { title: 'A', url: 'https://a.com', similarity: 0.9, embedding: [1, 0, 0] },
    };

    const result = dedupResults([a]);

    expect(result[0].metadata).not.toHaveProperty('embedding');
    expect(result[0].metadata).not.toHaveProperty('similarity');
    expect(result[0].metadata).toHaveProperty('title');
    expect(result[0].metadata).toHaveProperty('url');
  });

  it('returns max 20 results', () => {
    // 25 orthogonal-ish chunks
    const chunks: Chunk[] = Array.from({ length: 25 }, (_, i) => ({
      content: `Chunk ${i}`,
      metadata: {
        title: `T${i}`,
        url: `https://${i}.com`,
        similarity: 1 - i * 0.001,
        embedding: Array.from({ length: 25 }, (_, j) => (i === j ? 1 : 0)),
      },
    }));

    const result = dedupResults(chunks);

    expect(result).toHaveLength(20);
  });

  it('sorts by similarity descending', () => {
    const low: Chunk = {
      content: 'low',
      metadata: { title: 'L', url: 'https://l.com', similarity: 0.3, embedding: [1, 0, 0] },
    };
    const high: Chunk = {
      content: 'high',
      metadata: { title: 'H', url: 'https://h.com', similarity: 0.95, embedding: [0, 1, 0] },
    };
    const mid: Chunk = {
      content: 'mid',
      metadata: { title: 'M', url: 'https://m.com', similarity: 0.7, embedding: [0, 0, 1] },
    };

    const result = dedupResults([low, mid, high]);

    expect(result.map((r) => r.content)).toEqual(['high', 'mid', 'low']);
  });
});

// ---------------------------------------------------------------------------
// executeSpeedSearch
// ---------------------------------------------------------------------------

describe('executeSpeedSearch', () => {
  it('calls searchAndEmit for each query in parallel', async () => {
    const backend = createMockSearchBackend([
      { title: 'R1', url: 'https://r1.com', content: 'Content R1' },
    ]);
    const embedding = createMockEmbedding([
      [1, 0], [1, 0], // query1 + result1
      [1, 0], [1, 0], // query2 + result1
    ]);
    const session = createMockSession();
    const researchBlock = createResearchBlock();
    const llm = createMockChatModel();

    const result = await executeSpeedSearch(
      {
        queries: ['q1', 'q2'],
        mode: 'speed',
        searchConfig: undefined,
        researchBlock,
        session,
        llm,
        embedding,
        searchBackend: backend,
      },
      researchBlock,
    );

    // backend.search should have been called twice
    expect(backend.search).toHaveBeenCalledTimes(2);
    expect(result.length).toBeGreaterThan(0);
  });

  it('calls dedupResults on aggregated results', async () => {
    // Provide overlapping results for both queries
    const backend = createMockSearchBackend([
      { title: 'R1', url: 'https://r1.com', content: 'C1' },
    ]);
    // Same embedding for all → dedup will merge them
    const sameEmb = [1, 0];
    const embedding = createMockEmbedding([
      sameEmb, sameEmb, // q1
      sameEmb, sameEmb, // q2
    ]);
    const session = createMockSession();
    const researchBlock = createResearchBlock();

    const result = await executeSpeedSearch(
      {
        queries: ['q1', 'q2'],
        mode: 'speed',
        searchConfig: undefined,
        researchBlock,
        session,
        llm: createMockChatModel(),
        embedding,
        searchBackend: backend,
      },
      researchBlock,
    );

    // Two identical results deduped to one
    expect(result).toHaveLength(1);
  });

  it('returns deduplicated results', async () => {
    const backend = createMockSearchBackend([
      { title: 'Unique A', url: 'https://a.com', content: 'Content A' },
      { title: 'Unique B', url: 'https://b.com', content: 'Content B' },
    ]);
    // Return different embeddings per content text, deterministic regardless of parallel execution
    const embedding = {
      embedText: vi.fn().mockImplementation((texts: string[]) => {
        const text = texts[0];
        if (text === 'single query') return Promise.resolve([[1, 0, 0, 0]]);
        if (text === 'Content A') return Promise.resolve([[0.8, 0.6, 0, 0]]);
        if (text === 'Content B') return Promise.resolve([[0.8, 0, 0.6, 0]]);
        return Promise.resolve([[0, 0, 0, 1]]);
      }),
    } as unknown as EmbeddingModel;
    const session = createMockSession();
    const researchBlock = createResearchBlock();

    const result = await executeSpeedSearch(
      {
        queries: ['single query'],
        mode: 'speed',
        researchBlock,
        session,
        llm: createMockChatModel(),
        embedding,
        searchBackend: backend,
      },
      researchBlock,
    );

    // Both results pass sim>0.5 filter and are not deduped (cross-sim=0.64≤0.75)
    expect(result).toHaveLength(2);
    // metadata should be cleaned (no embedding/similarity)
    expect(result[0].metadata).not.toHaveProperty('embedding');
  });
});

// ---------------------------------------------------------------------------
// executeQualitySearch
// ---------------------------------------------------------------------------

describe('executeQualitySearch', () => {
  let backend: SearchBackend;
  let embedding: EmbeddingModel;
  let session: SearchSession;
  let researchBlock: ResearchBlock;
  let llm: ChatModel;

  beforeEach(() => {
    vi.mocked(Scraper.scrape).mockReset();
    vi.mocked(splitText).mockReset();

    backend = createMockSearchBackend([
      { title: 'R1', url: 'https://r1.com', content: 'Content R1' },
      { title: 'R2', url: 'https://r2.com', content: 'Content R2' },
      { title: 'R3', url: 'https://r3.com', content: 'Content R3' },
    ]);
    embedding = createMockEmbedding();
    session = createMockSession();
    researchBlock = createResearchBlock();
  });

  it('calls searchAndEmit for each query', async () => {
    llm = createMockChatModel({ picked_indices: [0] });
    vi.mocked(Scraper.scrape).mockResolvedValue({
      content: 'Scraped content',
      title: 'R1',
    });
    vi.mocked(splitText).mockReturnValue(['chunk1']);

    await executeQualitySearch(
      {
        queries: ['q1', 'q2'],
        mode: 'quality',
        researchBlock,
        session,
        llm,
        embedding,
        searchBackend: backend,
      },
      researchBlock,
    );

    // backend.search called once per query
    expect(backend.search).toHaveBeenCalledTimes(2);
  });

  it('uses LLM picker to select indices', async () => {
    llm = createMockChatModel({ picked_indices: [0, 2] });
    vi.mocked(Scraper.scrape).mockResolvedValue({
      content: 'Scraped',
      title: 'R',
    });
    vi.mocked(splitText).mockReturnValue(['chunk']);

    const result = await executeQualitySearch(
      {
        queries: ['q1'],
        mode: 'quality',
        researchBlock,
        session,
        llm,
        embedding,
        searchBackend: backend,
      },
      researchBlock,
    );

    // Should only scrape picked results (indices 0 and 2)
    expect(Scraper.scrape).toHaveBeenCalledTimes(2);
    expect(Scraper.scrape).toHaveBeenCalledWith('https://r1.com');
    expect(Scraper.scrape).toHaveBeenCalledWith('https://r3.com');
  });

  it('slices picker result to max 3 indices', async () => {
    llm = createMockChatModel({ picked_indices: [0, 1, 2, 3, 4] });
    vi.mocked(Scraper.scrape).mockResolvedValue({
      content: 'Scraped',
      title: 'R',
    });
    vi.mocked(splitText).mockReturnValue(['chunk']);

    await executeQualitySearch(
      {
        queries: ['q1'],
        mode: 'quality',
        researchBlock,
        session,
        llm,
        embedding,
        searchBackend: backend,
      },
      researchBlock,
    );

    // Only first 3 indices scraped (0, 1, 2)
    expect(Scraper.scrape).toHaveBeenCalledTimes(3);
  });

  it('filters already-extracted URLs', async () => {
    llm = createMockChatModel({ picked_indices: [0] });
    vi.mocked(Scraper.scrape).mockResolvedValue({
      content: 'Scraped',
      title: 'R',
    });
    vi.mocked(splitText).mockReturnValue(['chunk']);

    // Pre-populate a reading substep with r1 URL
    researchBlock.data.subSteps.push({
      id: 'existing-reading',
      type: 'reading',
      reading: [{ content: 'old', metadata: { title: 'Old', url: 'https://r1.com' } }],
    });

    await executeQualitySearch(
      {
        queries: ['q1'],
        mode: 'quality',
        researchBlock,
        session,
        llm,
        embedding,
        searchBackend: backend,
      },
      researchBlock,
    );

    // r1 is already extracted → should not scrape it
    expect(Scraper.scrape).not.toHaveBeenCalledWith('https://r1.com');
  });

  it('scrapes selected results and extracts facts via LLM', async () => {
    llm = {
      generateObject: vi.fn()
        .mockResolvedValueOnce({ picked_indices: [0] })
        .mockResolvedValueOnce({ extracted_facts: '- Fact 1\n- Fact 2' })
        .mockResolvedValueOnce({ extracted_facts: '- Fact 3' }),
    } as unknown as ChatModel;
    vi.mocked(Scraper.scrape).mockResolvedValue({
      content: 'Detailed content here',
      title: 'R1 Page',
    });
    vi.mocked(splitText).mockReturnValue(['chunk1', 'chunk2']);

    const result = await executeQualitySearch(
      {
        queries: ['q1'],
        mode: 'quality',
        researchBlock,
        session,
        llm,
        embedding,
        searchBackend: backend,
      },
      researchBlock,
    );

    // generateObject called once for picker + once per split chunk for extractor
    expect(llm.generateObject).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(1);
    expect(result[0].content).toContain('Fact 1');
  });

  it('handles scrape failure gracefully', async () => {
    llm = createMockChatModel({ picked_indices: [0, 1] });
    vi.mocked(Scraper.scrape)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        content: 'Good content',
        title: 'R2',
      });
    vi.mocked(splitText).mockReturnValue(['chunk1']);

    const result = await executeQualitySearch(
      {
        queries: ['q1'],
        mode: 'quality',
        researchBlock,
        session,
        llm,
        embedding,
        searchBackend: backend,
      },
      researchBlock,
    );

    // One scrape failed, one succeeded → one fact extracted
    expect(result).toHaveLength(1);
    expect(result[0].metadata.url).toBe('https://r2.com');
  });

  it('handles scrape returning null gracefully', async () => {
    llm = createMockChatModel({ picked_indices: [0] });
    vi.mocked(Scraper.scrape).mockResolvedValue(null as any);
    vi.mocked(splitText).mockReturnValue(['chunk']);

    const result = await executeQualitySearch(
      {
        queries: ['q1'],
        mode: 'quality',
        researchBlock,
        session,
        llm,
        embedding,
        searchBackend: backend,
      },
      researchBlock,
    );

    // scrape returned null → no extraction, no facts
    expect(result).toHaveLength(0);
  });

  it('handles splitText returning empty array', async () => {
    llm = createMockChatModel({ picked_indices: [0] });
    vi.mocked(Scraper.scrape).mockResolvedValue({
      content: 'Some content',
      title: 'R1',
    });
    vi.mocked(splitText).mockReturnValue([]);

    const result = await executeQualitySearch(
      {
        queries: ['q1'],
        mode: 'quality',
        researchBlock,
        session,
        llm,
        embedding,
        searchBackend: backend,
      },
      researchBlock,
    );

    // No chunks to extract from → accumulated content stays empty
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('');
  });

  it('returns empty facts when no results are picked', async () => {
    llm = createMockChatModel({ picked_indices: [] });
    vi.mocked(Scraper.scrape).mockResolvedValue({
      content: 'Scraped',
      title: 'R',
    });

    const result = await executeQualitySearch(
      {
        queries: ['q1'],
        mode: 'quality',
        researchBlock,
        session,
        llm,
        embedding,
        searchBackend: backend,
      },
      researchBlock,
    );

    expect(result).toHaveLength(0);
  });

  it('skips results when picker returns out-of-range indices', async () => {
    llm = createMockChatModel({ picked_indices: [99] });
    vi.mocked(Scraper.scrape).mockResolvedValue({
      content: 'Scraped',
      title: 'R',
    });

    const result = await executeQualitySearch(
      {
        queries: ['q1'],
        mode: 'quality',
        researchBlock,
        session,
        llm,
        embedding,
        searchBackend: backend,
      },
      researchBlock,
    );

    expect(result).toHaveLength(0);
    expect(Scraper.scrape).not.toHaveBeenCalled();
  });

  it('emits reading substep when filtered results exist', async () => {
    llm = createMockChatModel({ picked_indices: [0] });
    vi.mocked(Scraper.scrape).mockResolvedValue({
      content: 'Scraped',
      title: 'R1',
    });
    vi.mocked(splitText).mockReturnValue(['chunk1']);

    await executeQualitySearch(
      {
        queries: ['q1'],
        mode: 'quality',
        researchBlock,
        session,
        llm,
        embedding,
        searchBackend: backend,
      },
      researchBlock,
    );

    // Should have a reading substep
    const readingSteps = researchBlock.data.subSteps.filter(
      (s) => s.type === 'reading',
    );
    expect(readingSteps).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// executeSearch (baseSearch dispatcher)
// ---------------------------------------------------------------------------

describe('executeSearch', () => {
  let backend: SearchBackend;
  let embedding: EmbeddingModel;
  let session: SearchSession;
  let researchBlock: ResearchBlock;
  let llm: ChatModel;

  beforeEach(() => {
    backend = createMockSearchBackend([
      { title: 'R', url: 'https://r.com', content: 'C' },
    ]);
    embedding = createMockEmbedding([[1, 0], [1, 0]]);
    session = createMockSession();
    researchBlock = createResearchBlock();
    llm = createMockChatModel();
  });

  it('emits searching substep before delegating', async () => {
    await executeSearch({
      queries: ['q1'],
      mode: 'speed',
      researchBlock,
      session,
      llm,
      embedding,
      searchBackend: backend,
    });

    const searchingSteps = researchBlock.data.subSteps.filter(
      (s) => s.type === 'searching',
    );
    expect(searchingSteps).toHaveLength(1);
    expect(searchingSteps[0]).toMatchObject({
      type: 'searching',
      searching: ['q1'],
    });
  });

  it('delegates to speedSearch for speed mode', async () => {
    const result = await executeSearch({
      queries: ['q1'],
      mode: 'speed',
      researchBlock,
      session,
      llm,
      embedding,
      searchBackend: backend,
    });

    // speed mode: should return results from speed search
    expect(backend.search).toHaveBeenCalled();
    expect(Array.isArray(result)).toBe(true);
  });

  it('delegates to speedSearch for balanced mode', async () => {
    const result = await executeSearch({
      queries: ['q1'],
      mode: 'balanced',
      researchBlock,
      session,
      llm,
      embedding,
      searchBackend: backend,
    });

    expect(backend.search).toHaveBeenCalled();
    expect(Array.isArray(result)).toBe(true);
  });

  it('delegates to qualitySearch for quality mode', async () => {
    llm = createMockChatModel({ picked_indices: [0] });
    vi.mocked(Scraper.scrape).mockResolvedValue({
      content: 'Scraped',
      title: 'R',
    });
    vi.mocked(splitText).mockReturnValue(['chunk']);

    const result = await executeSearch({
      queries: ['q1'],
      mode: 'quality',
      researchBlock,
      session,
      llm,
      embedding,
      searchBackend: backend,
    });

    expect(backend.search).toHaveBeenCalled();
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns empty array for unknown mode', async () => {
    const result = await executeSearch({
      queries: ['q1'],
      mode: 'unknown' as any,
      researchBlock,
      session,
      llm,
      embedding,
      searchBackend: backend,
    });

    // Still emits the searching substep
    const searchingSteps = researchBlock.data.subSteps.filter(
      (s) => s.type === 'searching',
    );
    expect(searchingSteps).toHaveLength(1);

    // But returns empty results
    expect(result).toEqual([]);
    // backend.search should NOT be called (no delegation)
    expect(backend.search).not.toHaveBeenCalled();
  });

  it('calls session.updateBlock when emitting searching substep', async () => {
    await executeSearch({
      queries: ['q1'],
      mode: 'speed',
      researchBlock,
      session,
      llm,
      embedding,
      searchBackend: backend,
    });

    expect(session.updateBlock).toHaveBeenCalledWith(
      'rb-1',
      expect.arrayContaining([
        expect.objectContaining({
          op: 'replace',
          path: '/data/subSteps',
        }),
      ]),
    );
  });
});
