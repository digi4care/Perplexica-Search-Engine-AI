import type { Block } from '../types';

/**
 * Port interface for streaming events to the frontend via SSE.
 *
 * Replaces the untyped SessionManager singleton (emit(event: string, data: any))
 * with a typed event emitter. Each event name maps to a typed payload.
 *
 * This is the minimal interface the search pipeline needs. The full
 * SessionManager also handles block storage and event replay, but those
 * are infrastructure concerns handled by the adapter, not the domain.
 */

/** Map of event names to their payload types. */
export interface SessionEventMap {
  data: { type: string; block: Block };
  messageChunk: { content: string };
  error: { message: string };
  status: { status: string };
}

export interface SessionEmitter {
  /** Emit a typed event. */
  emit<K extends keyof SessionEventMap>(
    event: K,
    data: SessionEventMap[K],
  ): void;

  /** Emit a block update (creates + emits the data event). */
  emitBlock(block: Block): void;

  /** Update an existing block in place. */
  updateBlock(blockId: string, updates: Partial<Block>): void;

  /** Subscribe to events of a specific type. */
  on<K extends keyof SessionEventMap>(
    event: K,
    handler: (data: SessionEventMap[K]) => void,
  ): void;

  /** Remove all listeners. */
  removeAllListeners(): void;
}
