import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSessionStream, SSE_HEADERS } from '@/lib/http/sessionStream';
import type { SearchSession } from '@/lib/ports';

function createMockSession(): SearchSession & {
  __listeners: Map<string, Set<(data: any) => void>>;
} {
  const listeners = new Map<string, Set<(data: any) => void>>();

  return {
    id: 'test-session',
    __listeners: listeners,
    emit(event: string, data: Record<string, unknown>) {
      const set = listeners.get(event);
      if (set) set.forEach((fn) => fn(data));
    },
    emitBlock: vi.fn(),
    getBlock: vi.fn(),
    updateBlock: vi.fn(),
    getAllBlocks: vi.fn(),
    subscribe(listener: (event: string, data: any) => void) {
      const events = ['data', 'end', 'error'];
      events.forEach((e) => {
        const handler = (data: any) => listener(e, data);
        if (!listeners.has(e)) listeners.set(e, new Set());
        listeners.get(e)!.add(handler);
      });
      return () => {
        // noop for test simplicity
      };
    },
    removeAllListeners: vi.fn(),
  };
}

async function collectStream(readable: ReadableStream): Promise<string[]> {
  const reader = readable.getReader();
  const decoder = new TextDecoder();
  const lines: string[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    lines.push(...text.split('\n').filter((l) => l.length > 0));
  }

  return lines;
}

function parseLines(lines: string[]): Record<string, unknown>[] {
  return lines.map((l) => JSON.parse(l));
}

describe('createSessionStream', () => {
  let session: ReturnType<typeof createMockSession>;

  beforeEach(() => {
    session = createMockSession();
  });

  it('encodes block events to JSON lines', async () => {
    const { readable } = createSessionStream(session);

    session.emit('data', { type: 'block', block: { id: 'b1', type: 'text' } });
    session.emit('end', {});

    const lines = await collectStream(readable);
    const parsed = parseLines(lines);

    expect(parsed[0]).toEqual({ type: 'block', block: { id: 'b1', type: 'text' } });
    expect(parsed[1]).toEqual({ type: 'messageEnd' });
  });

  it('encodes updateBlock events', async () => {
    const { readable } = createSessionStream(session);

    session.emit('data', { type: 'updateBlock', blockId: 'b1', patch: [{ op: 'replace' }] });
    session.emit('end', {});

    const lines = await collectStream(readable);
    const parsed = parseLines(lines);

    expect(parsed[0]).toEqual({
      type: 'updateBlock',
      blockId: 'b1',
      patch: [{ op: 'replace' }],
    });
  });

  it('encodes researchComplete events', async () => {
    const { readable } = createSessionStream(session);

    session.emit('data', { type: 'researchComplete' });
    session.emit('end', {});

    const lines = await collectStream(readable);
    const parsed = parseLines(lines);

    expect(parsed[0]).toEqual({ type: 'researchComplete' });
  });

  it('encodes error events and closes stream', async () => {
    const { readable } = createSessionStream(session);

    session.emit('error', { data: 'Something went wrong' });

    const lines = await collectStream(readable);
    const parsed = parseLines(lines);

    expect(parsed[0]).toEqual({ type: 'error', data: 'Something went wrong' });
  });

  it('close() stops the stream', async () => {
    const { readable, close } = createSessionStream(session);

    close();

    // Stream should be done after close
    const reader = readable.getReader();
    const { done } = await reader.read();
    expect(done).toBe(true);
  });
});

describe('SSE_HEADERS', () => {
  it('has correct Content-Type', () => {
    expect(SSE_HEADERS['Content-Type']).toBe('text/event-stream');
  });

  it('has no-cache Cache-Control', () => {
    expect(SSE_HEADERS['Cache-Control']).toBe('no-cache, no-transform');
  });

  it('has keep-alive Connection', () => {
    expect(SSE_HEADERS['Connection']).toBe('keep-alive');
  });
});
