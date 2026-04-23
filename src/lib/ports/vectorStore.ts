import type { Chunk } from '../types';

/**
 * Port interface for vector similarity search over embedded content.
 *
 * Current adapter: JsonFileVectorStore (brute-force JS cosine similarity).
 * Post-MVP adapter: SqliteVecVectorStore (native KNN via sqlite-vec).
 *
 * The interface accepts pre-computed embeddings rather than raw text,
 * keeping embedding generation a separate concern.
 */
export interface VectorSearchResult extends Chunk {}

export interface VectorStore {
  /**
   * Upsert embedding vectors for a document's chunks.
   * Replaces any existing vectors for the given docId.
   */
  upsert(
    docId: string,
    chunks: { content: string; embedding: number[]; metadata: Record<string, unknown> }[],
  ): Promise<void>;

  /**
   * Find the top-K most similar chunks to the given embedding vector.
   */
  query(embedding: number[], topK: number): Promise<VectorSearchResult[]>;

  /**
   * Remove all vectors for a document.
   */
  delete(docId: string): Promise<void>;
}
