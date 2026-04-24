import type { SearchSession } from '@/lib/ports';

const encoder = new TextEncoder();

function encodeLine(data: Record<string, unknown>): Uint8Array {
  return encoder.encode(JSON.stringify(data) + '\n');
}

/**
 * Subscribe to a SearchSession and pipe events as newline-delimited JSON
 * into a TransformStream. Returns the readable end plus a cleanup function.
 *
 * Event mapping:
 *   session 'data' (type=block)        → { type: 'block', block }
 *   session 'data' (type=updateBlock)  → { type: 'updateBlock', blockId, patch }
 *   session 'data' (type=researchComplete) → { type: 'researchComplete' }
 *   session 'end'                      → { type: 'messageEnd' }  + close writer
 *   session 'error'                    → { type: 'error', data }  + close writer
 */
export function createSessionStream(
  session: SearchSession,
  signal?: AbortSignal,
): { readable: ReadableStream; close: () => void } {
  const transform = new TransformStream();
  const writer = transform.writable.getWriter();

  let closed = false;

  const closeWriter = () => {
    if (closed) return;
    closed = true;
    try {
      writer.close();
    } catch {
      // Already closed — ignore.
    }
  };

  const disconnect = session.subscribe((event: string, data: any) => {
    if (closed) return;

    if (event === 'data') {
      if (data.type === 'block') {
        writer.write(
          encodeLine({ type: 'block', block: data.block }),
        );
      } else if (data.type === 'updateBlock') {
        writer.write(
          encodeLine({ type: 'updateBlock', blockId: data.blockId, patch: data.patch }),
        );
      } else if (data.type === 'researchComplete') {
        writer.write(encodeLine({ type: 'researchComplete' }));
      }
    } else if (event === 'end') {
      writer.write(encodeLine({ type: 'messageEnd' }));
      closeWriter();
      disconnect();
    } else if (event === 'error') {
      writer.write(encodeLine({ type: 'error', data: data.data }));
      closeWriter();
      disconnect();
    }
  });

  if (signal) {
    signal.addEventListener('abort', () => {
      disconnect();
      closeWriter();
    });
  }

  return {
    readable: transform.readable,
    close: () => {
      disconnect();
      closeWriter();
    },
  };
}

/** SSE response headers — shared across all streaming endpoints. */
export const SSE_HEADERS: Record<string, string> = {
  'Content-Type': 'text/event-stream',
  Connection: 'keep-alive',
  'Cache-Control': 'no-cache, no-transform',
};
