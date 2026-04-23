import { EventEmitter } from 'stream';
import type { Block } from '@/lib/types';

/**
 * Creates a fake SessionManager for testing.
 *
 * Captures emitted events and blocks for assertion without
 * relying on the real singleton or TTL timer.
 */
export function createMockSession(id?: string) {
  const blocks = new Map<string, Block>();
  const events: { event: string; data: any }[] = [];
  const emitter = new EventEmitter();
  // Prevent EventEmitter from throwing on 'error' events without listeners
  emitter.on('error', () => {});

  return {
    id: id ?? crypto.randomUUID(),
    blocks,
    events,
    emitter,

    emit(event: string, data: any) {
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

    removeAllListeners() {
      emitter.removeAllListeners();
    },

    /** Get captured events for assertion */
    getEvents(): readonly { event: string; data: any }[] {
      return events;
    },

    /** Get events of a specific type */
    getEventsByType(event: string) {
      return events.filter((e) => e.event === event);
    },
  };
}

export type MockSession = ReturnType<typeof createMockSession>;
