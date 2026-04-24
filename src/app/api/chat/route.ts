import { z } from 'zod';

import { ModelWithProvider } from '@/lib/models/types';
import { createSessionStream, SSE_HEADERS } from '@/lib/http/sessionStream';
import ChatService from '@/lib/services/chatService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const messageSchema = z.object({
  messageId: z.string().min(1, 'Message ID is required'),
  chatId: z.string().min(1, 'Chat ID is required'),
  content: z.string().min(1, 'Message content is required'),
});

const chatModelSchema: z.ZodType<ModelWithProvider> = z.object({
  providerId: z.string({ message: 'Chat model provider id must be provided' }),
  key: z.string({ message: 'Chat model key must be provided' }),
});

const embeddingModelSchema: z.ZodType<ModelWithProvider> = z.object({
  providerId: z.string({ message: 'Embedding model provider id must be provided' }),
  key: z.string({ message: 'Embedding model key must be provided' }),
});

const bodySchema = z.object({
  message: messageSchema,
  optimizationMode: z.enum(['speed', 'balanced', 'quality'], {
    message: 'Optimization mode must be one of: speed, balanced, quality',
  }),
  sources: z.array(z.string()).optional().default([]),
  history: z.array(z.tuple([z.string(), z.string()])).optional().default([]),
  files: z.array(z.string()).optional().default([]),
  chatModel: chatModelSchema,
  embeddingModel: embeddingModelSchema,
  systemInstructions: z.string().nullable().optional().default(''),
});

const safeValidateBody = (data: unknown) => {
  const result = bodySchema.safeParse(data);
  if (!result.success) {
    return {
      success: false as const,
      error: result.error.issues.map((e: any) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    };
  }
  return { success: true as const, data: result.data };
};

const service = new ChatService();

export const POST = async (req: Request) => {
  try {
    const parsed = safeValidateBody(await req.json());
    if (!parsed.success) {
      return Response.json(
        { message: 'Invalid request body', error: parsed.error },
        { status: 400 },
      );
    }
    if (parsed.data.message.content === '') {
      return Response.json(
        { message: 'Please provide a message to process' },
        { status: 400 },
      );
    }
    const { session } = await service.handleChat(parsed.data);
    const { readable } = createSessionStream(session, req.signal);
    return new Response(readable, { headers: SSE_HEADERS });
  } catch (err) {
    console.error('An error occurred while processing chat request:', err);
    return Response.json(
      { message: 'An error occurred while processing chat request' },
      { status: 500 },
    );
  }
};
