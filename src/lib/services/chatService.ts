import type { ChatTurnMessage } from '@/lib/types';
import type { SearchSources } from '@/lib/agents/search/types';
import type { SearchSession } from '@/lib/ports';
import {
  getModelRegistry,
  getSearchBackend,
  createSearchAgent,
  createSession,
} from '@/lib/composition';
import db from '@/lib/db';
import { eq } from 'drizzle-orm';
import { chats } from '@/lib/db/schema';
import UploadManager from '@/lib/uploads/manager';

export interface ChatRequest {
  message: { messageId: string; chatId: string; content: string };
  optimizationMode: 'speed' | 'balanced' | 'quality';
  sources: string[];
  history: Array<[string, string]>;
  files: string[];
  chatModel: { providerId: string; key: string };
  embeddingModel: { providerId: string; key: string };
  systemInstructions: string | null;
}

export interface ChatResult {
  session: SearchSession;
}

class ChatService {
  async handleChat(request: ChatRequest): Promise<ChatResult> {
    const registry = getModelRegistry();

    const [llm, embedding] = await Promise.all([
      registry.loadChatModel(request.chatModel.providerId, request.chatModel.key),
      registry.loadEmbeddingModel(
        request.embeddingModel.providerId,
        request.embeddingModel.key,
      ),
    ]);

    const history: ChatTurnMessage[] = request.history.map((msg) => ({
      role: msg[0] === 'human' ? 'user' as const : 'assistant' as const,
      content: msg[1],
    }));

    const searchBackend = getSearchBackend();
    const agent = createSearchAgent();
    const session = createSession();

    agent.searchAsync(session, {
      chatHistory: history,
      followUp: request.message.content,
      chatId: request.message.chatId,
      messageId: request.message.messageId,
      config: {
        llm,
        embedding,
        searchBackend,
        sources: request.sources as SearchSources[],
        mode: request.optimizationMode,
        fileIds: request.files,
        systemInstructions: request.systemInstructions || 'None',
      },
    });

    this.ensureChatExists({
      id: request.message.chatId,
      sources: request.sources as SearchSources[],
      fileIds: request.files,
      query: request.message.content,
    });

    return { session };
  }

  private ensureChatExists(input: {
    id: string;
    sources: SearchSources[];
    query: string;
    fileIds: string[];
  }): void {
    // Fire-and-forget — errors logged but never propagated.
    (async () => {
      try {
        const exists = await db.query.chats
          .findFirst({ where: eq(chats.id, input.id) })
          .execute();

        if (!exists) {
          await db.insert(chats).values({
            id: input.id,
            createdAt: new Date().toISOString(),
            sources: input.sources,
            title: input.query,
            files: input.fileIds.map((id) => ({
              fileId: id,
              name: UploadManager.getFile(id)?.name || 'Uploaded File',
            })),
          });
        }
      } catch (err) {
        console.error('Failed to check/save chat:', err);
      }
    })();
  }
}

export default ChatService;
