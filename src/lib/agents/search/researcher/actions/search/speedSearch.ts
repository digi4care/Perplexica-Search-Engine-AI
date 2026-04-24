import type {
  EmbeddingModel,
  SearchBackend,
  SearchOptions,
  SearchSession,
} from '@/lib/ports';
import { Chunk, ResearchBlock } from '@/lib/types';
import { SearchAgentConfig } from '../../../types';
import { searchAndEmit, dedupResults } from './searchHelpers';

export const executeSpeedSearch = async (
  input: {
    queries: string[];
    mode: SearchAgentConfig['mode'];
    searchConfig?: SearchOptions;
    researchBlock: ResearchBlock;
    session: SearchSession;
    llm: import('@/lib/ports').ChatModel;
    embedding: EmbeddingModel;
    searchBackend: SearchBackend;
  },
  researchBlock: ResearchBlock,
): Promise<Chunk[]> => {
  const searchResultsBlockId = crypto.randomUUID();
  const searchResultsEmitted = { value: false };

  const results: Chunk[] = [];

  const search = async (q: string) => {
    const chunks = await searchAndEmit(
      q,
      input.mode,
      input.searchConfig,
      input.embedding,
      input.searchBackend,
      researchBlock,
      input.session,
      searchResultsBlockId,
      searchResultsEmitted,
    );
    results.push(...chunks);
  };

  await Promise.all(input.queries.map(search));

  return dedupResults(results);
};
