import type { ChatTurnMessage } from '@/lib/types';
import type { SearchSources } from '@/lib/agents/search/types';
import type { SearchSession } from '@/lib/ports';
import {
  createApiSearchAgent,
  createSession,
  getSearchBackend,
  getModelRegistry,
} from '@/lib/composition';

export interface SearchRequest {
  query: string;
  optimizationMode: 'speed' | 'balanced' | 'quality';
  sources: SearchSources[];
  history: Array<[string, string]>;
  chatModel: { providerId: string; key: string };
  embeddingModel: { providerId: string; key: string };
  stream?: boolean;
  systemInstructions?: string;
}

export interface SearchSessionResult {
  session: SearchSession;
}

export interface CollectedSearchResult {
  message: string;
  sources: unknown[];
}

class SearchService {
  /**
   * Handle a search request: load models, set up agent + session, start search.
   * Returns the session for SSE streaming or result collection.
   */
  async handleSearch(request: SearchRequest): Promise<SearchSessionResult> {
    const registry = getModelRegistry();

    const [llm, embeddings] = await Promise.all([
      registry.loadChatModel(request.chatModel.providerId, request.chatModel.key),
      registry.loadEmbeddingModel(
        request.embeddingModel.providerId,
        request.embeddingModel.key,
      ),
    ]);

    const history: ChatTurnMessage[] = request.history.map((msg) =>
      msg[0] === 'human'
        ? { role: 'user', content: msg[1] }
        : { role: 'assistant', content: msg[1] },
    );

    const session = createSession();

    const searchBackend = getSearchBackend();
    const agent = createApiSearchAgent();
    agent.searchAsync(session, {
      chatHistory: history,
      config: {
        embedding: embeddings,
        llm,
        searchBackend,
        sources: request.sources,
        mode: request.optimizationMode,
        fileIds: [],
        systemInstructions: request.systemInstructions || '',
      },
      followUp: request.query,
      chatId: crypto.randomUUID(),
      messageId: crypto.randomUUID(),
    });

    return { session };
  }

  /**
   * Collect results from a session (for non-streaming responses).
   */
  collectResults(session: SearchSession): Promise<CollectedSearchResult> {
    return new Promise((resolve, reject) => {
      let message = '';
      let sources: unknown[] = [];

      session.subscribe((event: string, data: Record<string, unknown>) => {
        if (event === 'data') {
          try {
            if (data.type === 'response') {
              message += data.data;
            } else if (data.type === 'searchResults') {
              sources = data.data as unknown[];
            }
          } catch {
            reject(new Error('Error parsing data'));
          }
        }

        if (event === 'end') {
          resolve({ message, sources });
        }

        if (event === 'error') {
          reject(new Error('Search error'));
        }
      });
    });
  }
}

export default SearchService;
