import type {
  EmbeddingModel,
  SearchBackend,
  SearchOptions,
  SearchSession,
} from '@/lib/ports';
import { Chunk, ResearchBlock, SearchResultsResearchBlock } from '@/lib/types';
import { SearchAgentConfig } from '../../../types';
import computeSimilarity from '@/lib/utils/computeSimilarity';

export const searchAndEmit = async (
  query: string,
  mode: SearchAgentConfig['mode'],
  searchConfig: SearchOptions | undefined,
  embedding: EmbeddingModel,
  searchBackend: SearchBackend,
  researchBlock: ResearchBlock,
  session: SearchSession,
  searchResultsBlockId: string,
  searchResultsEmitted: { value: boolean },
): Promise<Chunk[]> => {
  const res = await searchBackend.search(query, {
    ...(searchConfig ? searchConfig : {}),
  });

  let resultChunks: Chunk[] = [];

  if (mode === 'speed' || mode === 'balanced') {
    try {
      const queryEmbedding = (await embedding.embedText([query]))[0];

      resultChunks = (
        await Promise.all(
          res.results.map(async (r) => {
            const content = r.content || r.title;
            const chunkEmbedding = (
              await embedding.embedText([content])
            )[0];

            return {
              content,
              metadata: {
                title: r.title,
                url: r.url,
                similarity: computeSimilarity(queryEmbedding, chunkEmbedding),
                embedding: chunkEmbedding,
              },
            };
          }),
        )
      ).filter((c) => c.metadata.similarity > 0.5);
    } catch (err) {
      resultChunks = res.results.map((r) => {
        const content = r.content || r.title;

        return {
          content,
          metadata: {
            title: r.title,
            url: r.url,
            similarity: 1,
            embedding: [],
          },
        };
      });
    }
  } else {
    resultChunks = res.results.map((r) => {
      const content = r.content || r.title;

      return {
        content,
        metadata: {
          title: r.title,
          url: r.url,
          similarity: 1,
          embedding: [],
        },
      };
    });
  }

  if (!searchResultsEmitted.value) {
    searchResultsEmitted.value = true;

    researchBlock.data.subSteps.push({
      id: searchResultsBlockId,
      type: 'search_results',
      reading: resultChunks,
    });

    session.updateBlock(researchBlock.id, [
      {
        op: 'replace',
        path: '/data/subSteps',
        value: researchBlock.data.subSteps,
      },
    ]);
  } else {
    const subStepIndex = researchBlock.data.subSteps.findIndex(
      (step) => step.id === searchResultsBlockId,
    );

    const subStep = researchBlock.data.subSteps[
      subStepIndex
    ] as SearchResultsResearchBlock;

    subStep.reading.push(...resultChunks);

    session.updateBlock(researchBlock.id, [
      {
        op: 'replace',
        path: '/data/subSteps',
        value: researchBlock.data.subSteps,
      },
    ]);
  }

  return resultChunks;
};

export const dedupResults = (results: Chunk[]): Chunk[] => {
  results.sort((a, b) => b.metadata.similarity - a.metadata.similarity);

  const uniqueIndices: Set<number> = new Set();

  for (let i = 0; i < results.length; i++) {
    let isDuplicate = false;

    for (const indice of uniqueIndices.keys()) {
      if (
        results[i].metadata.embedding.length === 0 ||
        results[indice].metadata.embedding.length === 0
      )
        continue;

      const similarity = computeSimilarity(
        results[i].metadata.embedding,
        results[indice].metadata.embedding,
      );

      if (similarity > 0.75) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      uniqueIndices.add(i);
    }
  }

  return Array.from(uniqueIndices.keys())
    .map((i) => {
      const uniqueResult = results[i];

      delete uniqueResult.metadata.embedding;
      delete uniqueResult.metadata.similarity;

      return uniqueResult;
    })
    .slice(0, 20);
};
