import { describe, it, expect, beforeEach } from 'vitest';
import { createMockSession } from './fixtures';

/**
 * Smoke tests for SessionManager behavior.
 *
 * Uses the mock session factory rather than the real singleton
 * to avoid global state pollution between tests.
 */
describe('SessionManager', () => {
  describe('createMockSession (fixture validation)', () => {
    it('creates a session with a unique id', () => {
      const s1 = createMockSession();
      const s2 = createMockSession();
      expect(s1.id).toBeTruthy();
      expect(s2.id).toBeTruthy();
      expect(s1.id).not.toBe(s2.id);
    });

    it('uses provided id when given', () => {
      const session = createMockSession('test-id');
      expect(session.id).toBe('test-id');
    });
  });

  describe('emit and capture', () => {
    let session: ReturnType<typeof createMockSession>;

    beforeEach(() => {
      session = createMockSession();
    });

    it('captures emitted events', () => {
      session.emit('test-event', { foo: 'bar' });
      const events = session.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].event).toBe('test-event');
      expect(events[0].data).toEqual({ foo: 'bar' });
    });

    it('captures multiple events in order', () => {
      session.emit('first', { n: 1 });
      session.emit('second', { n: 2 });
      session.emit('third', { n: 3 });
      const events = session.getEvents();
      expect(events).toHaveLength(3);
      expect(events.map((e) => e.event)).toEqual(['first', 'second', 'third']);
    });

    it('filters events by type', () => {
      session.emit('data', { type: 'block' });
      session.emit('error', { msg: 'fail' });
      session.emit('data', { type: 'status' });
      const dataEvents = session.getEventsByType('data');
      expect(dataEvents).toHaveLength(2);
    });
  });

  describe('block management', () => {
    let session: ReturnType<typeof createMockSession>;

    beforeEach(() => {
      session = createMockSession();
    });

    it('stores and retrieves blocks', () => {
      const block = {
        id: 'block-1',
        type: 'text' as const,
        data: 'Hello world',
      };
      session.emitBlock(block);
      expect(session.getBlock('block-1')).toEqual(block);
    });

    it('returns undefined for unknown block id', () => {
      expect(session.getBlock('nonexistent')).toBeUndefined();
    });

    it('emits data event when block is emitted', () => {
      const block = {
        id: 'block-1',
        type: 'text' as const,
        data: 'Hello',
      };
      session.emitBlock(block);
      const events = session.getEventsByType('data');
      expect(events).toHaveLength(1);
      expect((events[0].data as Record<string, unknown>).type).toBe('block');
      expect(((events[0].data as Record<string, unknown>).block as { id: string }).id).toBe('block-1');
    });
  });
});
