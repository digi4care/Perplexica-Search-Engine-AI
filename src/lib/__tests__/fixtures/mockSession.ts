import { EventEmitter } from 'stream';
import type { Block } from '@/lib/types';
import type { SearchSession } from '@/lib/ports';

interface PatchOp {
  op: string;
  path: string;
  value: unknown;
}

/**
 * Extended mock session with test inspection helpers.
 */
export interface MockSession extends SearchSession {
  getEvents(): readonly { event: string; data: unknown }[];
  getEventsByType(event: string): { event: string; data: unknown }[];
  getBlocks(): ReadonlyMap<string, Block>;
}

/**
 * Creates a fake SearchSession for testing.
 *
 * Captures emitted events and blocks for assertion without
 * relying on the real singleton or TTL timer.
 * Satisfies the SearchSession port interface.
 */
export function createMockSession(id?: string): MockSession {
  const blocks = new Map<string, Block>();
  const events: { event: string; data: unknown }[] = [];
  const emitter = new EventEmitter();
  // Prevent EventEmitter from throwing on 'error' events without listeners
  emitter.on('error', () => {});

  const session: MockSession = {
    id: id ?? crypto.randomUUID(),

    emit(event: string, data: Record<string, unknown>) {
      emitter.emit(event, data);
      events.push({ event, data });
    },

    emitBlock(block: Block) {
      blocks.set(block.id, block);
      emitter.emit('data', { type: 'block', block });
      events.push({ event: 'data', data: { type: 'block', block } });
    },

    getBlock(blockId: string): Block | undefined {
      return blocks.get(blockId);
    },

    updateBlock(blockId: string, patch: unknown[]) {
      const block = blocks.get(blockId);
      if (!block || !patch) return;
      for (const raw of patch) {
        const op = raw as PatchOp;
        if (op.op === 'replace' && op.path) {
          const parts = op.path.replace(/^\//, '').split('/');
          let target: Record<string, unknown> = block as unknown as Record<string, unknown>;
          for (let i = 0; i < parts.length - 1; i++) {
            target = target[parts[i]] as Record<string, unknown>;
          }
          target[parts[parts.length - 1]] = op.value;
        }
      }
    },

    getAllBlocks(): Block[] {
      return Array.from(blocks.values());
    },

    subscribe(
      listener: (event: string, data: Record<string, unknown>) => void,
    ): () => void {
      const handler = (data: unknown) => listener('data', data as Record<string, unknown>);
      const endHandler = (data: unknown) => listener('end', data as Record<string, unknown>);
      const errorHandler = (data: unknown) => listener('error', data as Record<string, unknown>);
      emitter.on('data', handler);
      emitter.on('end', endHandler);
      emitter.on('error', errorHandler);
      return () => {
        emitter.off('data', handler);
        emitter.off('end', endHandler);
        emitter.off('error', errorHandler);
      };
    },

    removeAllListeners() {
      emitter.removeAllListeners();
    },

    /** Get captured events for assertion */
    getEvents(): readonly { event: string; data: unknown }[] {
      return events;
    },

    /** Get events of a specific type */
    getEventsByType(event: string) {
      return events.filter((e) => e.event === event);
    },

    /** Get blocks map for assertion */
    getBlocks(): ReadonlyMap<string, Block> {
      return blocks;
    },
  };

  return session;
}
