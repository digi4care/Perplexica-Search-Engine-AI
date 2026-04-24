import { embed, embedMany } from 'ai';
import type { EmbeddingModel } from 'ai';
import BaseEmbedding from '../base/embedding';
import { Chunk } from '@/lib/types';

type SdkEmbeddingConfig = { model: EmbeddingModel };

class SdkEmbedding extends BaseEmbedding<SdkEmbeddingConfig> {
  async embedText(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    if (texts.length === 1) {
      const { embedding } = await embed({
        model: this.config.model,
        value: texts[0],
      });
      return [embedding];
    }

    const { embeddings } = await embedMany({
      model: this.config.model,
      values: texts,
    });
    return embeddings;
  }

  async embedChunks(chunks: Chunk[]): Promise<number[][]> {
    const texts = chunks.map((c) => c.content);
    return this.embedText(texts);
  }
}

export default SdkEmbedding;
