/**
 * Port interface for embedding generation.
 *
 * Wraps the subset of BaseEmbedding methods used by the search pipeline.
 * Currently only embedText is called (by baseSearch and upload similarity).
 */
export interface EmbeddingModel {
  /**
   * Generate embeddings for an array of text strings.
   * Returns one embedding vector per input string.
   */
  embedText(texts: string[]): Promise<number[][]>;
}
