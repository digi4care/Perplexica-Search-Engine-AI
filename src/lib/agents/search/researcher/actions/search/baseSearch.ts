import type {
  ChatModel,
  EmbeddingModel,
  SearchBackend,
  SearchOptions,
  SearchSession,
} from '@/lib/ports';
import { ResearchBlock } from '@/lib/types';
import { SearchAgentConfig } from '../../../types';
import { executeSpeedSearch } from './speedSearch';
import { executeQualitySearch } from './qualitySearch';

type SearchInput = {
  queries: string[];
  mode: SearchAgentConfig['mode'];
  searchConfig?: SearchOptions;
  researchBlock: ResearchBlock;
  session: SearchSession;
  llm: ChatModel;
  embedding: EmbeddingModel;
  searchBackend: SearchBackend;
};

export const executeSearch = async (input: SearchInput) => {
  const researchBlock = input.researchBlock;

  researchBlock.data.subSteps.push({
    id: crypto.randomUUID(),
    type: 'searching',
    searching: input.queries,
  });

  input.session.updateBlock(researchBlock.id, [
    {
      op: 'replace',
      path: '/data/subSteps',
      value: researchBlock.data.subSteps,
    },
  ]);

  if (input.mode === 'speed' || input.mode === 'balanced') {
    return executeSpeedSearch(input, researchBlock);
  } else if (input.mode === 'quality') {
    return executeQualitySearch(input, researchBlock);
  }

  return [];
};
