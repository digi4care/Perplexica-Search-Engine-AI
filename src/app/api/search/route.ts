import { z } from 'zod';
import { SSE_HEADERS } from '@/lib/http/sessionStream';
import { SearchSources } from '@/lib/agents/search/types';
import SearchService from '@/lib/services/searchService';

const bodySchema = z.object({
  query: z.string().min(1, 'Query is required'),
  sources: z.array(z.enum(['web', 'discussions', 'academic'])).min(1, 'At least one source is required'),
  optimizationMode: z.enum(['speed', 'balanced', 'quality']).default('speed'),
  history: z.array(z.tuple([z.string(), z.string()])).default([]),
  chatModel: z.object({
    providerId: z.string(),
    key: z.string(),
  }),
  embeddingModel: z.object({
    providerId: z.string(),
    key: z.string(),
  }),
  stream: z.boolean().default(false),
  systemInstructions: z.string().default(''),
});

const service = new SearchService();

export const POST = async (req: Request) => {
  try {
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { message: 'Invalid request', errors: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const data = parsed.data;

    const { session } = await service.handleSearch(data);

    if (!data.stream) {
      const result = await service.collectResults(session);
      return Response.json(result, { status: 200 });
    }

    const encoder = new TextEncoder();
    const abortController = new AbortController();
    const { signal } = abortController;

    const stream = new ReadableStream({
      start(controller) {
        let sources: unknown[] = [];

        controller.enqueue(
          encoder.encode(JSON.stringify({ type: 'init', data: 'Stream connected' }) + '\n'),
        );

        signal.addEventListener('abort', () => {
          session.removeAllListeners();
          try { controller.close(); } catch {}
        });

        session.subscribe((event: string, data: Record<string, unknown>) => {
          if (event === 'data') {
            if (signal.aborted) return;
            try {
              if (data.type === 'response') {
                controller.enqueue(
                  encoder.encode(JSON.stringify({ type: 'response', data: data.data }) + '\n'),
                );
              } else if (data.type === 'searchResults') {
                sources = data.data as unknown[];
                controller.enqueue(
                  encoder.encode(JSON.stringify({ type: 'sources', data: sources }) + '\n'),
                );
              }
            } catch (error) {
              controller.error(error);
            }
          }

          if (event === 'end') {
            if (signal.aborted) return;
            controller.enqueue(encoder.encode(JSON.stringify({ type: 'done' }) + '\n'));
            controller.close();
          }

          if (event === 'error') {
            if (signal.aborted) return;
            controller.error(data);
          }
        });
      },
      cancel() {
        abortController.abort();
      },
    });

    return new Response(stream, { headers: SSE_HEADERS });
  } catch (err: any) {
    console.error(`Error in getting search results: ${err.message}`);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
