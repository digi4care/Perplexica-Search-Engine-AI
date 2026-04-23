import type { Block } from '../types';

/**
 * Port interface for the search session — event streaming + block management.
 *
 * This is the full contract the search pipeline (SearchAgent, Researcher,
 * ActionRegistry) needs from a session. The existing SessionManager class
 * becomes the adapter that implements this interface.
 *
 * Design decisions:
 * - emit() is untyped (event: string, data: any) because the search pipeline
 *   emits heterogeneous data events (block, updateBlock, researchComplete,
 *   response, searchResults) and typed event maps would require union casts.
 *   Type safety is enforced at the consumer side (routes).
 * - updateBlock() uses RFC6902 JSON Patch (any[]) because that's what the
 *   existing SessionManager uses and what the frontend expects.
 * - subscribe() returns an unsubscribe function for cleanup.
 *
 * Patterns: Adapter (SessionManager adapts to this interface),
 * Observer (event subscription model).
 */
export interface SearchSession {
  /** Unique session identifier. */
  readonly id: string;

  /** Emit an event with arbitrary data payload. */
  emit(event: string, data: Record<string, unknown>): void;

  /** Emit a block (stores it + emits the 'data' event with type: 'block'). */
  emitBlock(block: Block): void;

  /** Retrieve a previously emitted block by ID. */
  getBlock(blockId: string): Block | undefined;

  /** Update a block in-place using RFC6902 JSON Patch operations. */
  updateBlock(blockId: string, patch: unknown[]): void;

  /** Get all emitted blocks (used for persisting to MessageStore). */
  getAllBlocks(): Block[];

  /**
   * Subscribe to all session events (data, end, error).
   * Returns an unsubscribe function.
   */
  subscribe(
    listener: (event: string, data: Record<string, unknown>) => void,
  ): () => void;

  /** Remove all event listeners. */
  removeAllListeners(): void;
}

/**
 * @deprecated Use SearchSession instead. Kept for backward compatibility
 * during migration. Will be removed once all consumers are updated.
 */
export type SessionEmitter = SearchSession;
