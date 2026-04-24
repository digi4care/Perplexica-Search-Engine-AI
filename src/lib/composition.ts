import ModelRegistry from '@/lib/models/registry';

import SearchAgent from '@/lib/agents/search';
import APISearchAgent from '@/lib/agents/search/api';
import { DrizzleMessageStore, SearxngSearchBackend, SqliteVecVectorStore } from '@/lib/adapters';
import SessionManager from '@/lib/session';
import type { MessageStore, SearchBackend, SearchSession, VectorStore } from '@/lib/ports';

/**
 * Composition root for the search pipeline.
 *
 * Centralizes all dependency wiring in one place. Routes call factory
 * functions here instead of constructing adapters inline. This is the
 * only place that knows about concrete adapter classes.
 *
 * Pattern: Dependency Injection (composition root variant).
 * Each factory creates a fully-wired object graph.
 *
 * Adapter singletons are lazily instantiated module-level objects.
 * They're stateless so reuse is safe.
 */

// --- Stateless adapter singletons ---

let _messageStore: MessageStore | undefined;
let _searchBackend: SearchBackend | undefined;
let _vectorStore: VectorStore | undefined;

export function getMessageStore(): MessageStore {
  if (!_messageStore) {
    _messageStore = new DrizzleMessageStore();
  }
  return _messageStore;
}

export function getSearchBackend(): SearchBackend {
  if (!_searchBackend) {
    _searchBackend = new SearxngSearchBackend();
  }
  return _searchBackend;
}


export function getVectorStore(): VectorStore {
  if (!_vectorStore) {
    _vectorStore = new SqliteVecVectorStore();
  }
  return _vectorStore;
}

// --- Session registry ---

const activeSessions = new Map<string, SearchSession>();

export function createSession(): SearchSession {
  const session = SessionManager.createSession();
  activeSessions.set(session.id, session);
  return session;
}

export function getSession(id: string): SearchSession | undefined {
  return activeSessions.get(id);
}

// --- Model registry singleton ---

let _registry: ModelRegistry | undefined;

/**
 * Lazily-initialized ModelRegistry singleton.
 * Providers are loaded once and reused across requests.
 * Call reloadModelRegistry() after provider CRUD mutations.
 */
export function getModelRegistry(): ModelRegistry {
  if (!_registry) {
    _registry = new ModelRegistry();
  }
  return _registry;
}

/**
 * Force re-initialization of the ModelRegistry singleton.
 * Called after provider add/update/delete so the next
 * request sees the updated provider list.
 */
export function reloadModelRegistry(): void {
  if (_registry) {
    _registry.reload();
  }
}

// --- Agent factories ---

export function createSearchAgent(): SearchAgent {
  return new SearchAgent(getMessageStore());
}

export function createApiSearchAgent(): APISearchAgent {
  return new APISearchAgent(createSession);
}

/**
 * Reset adapters (for testing only).
 */
export function resetAdapters(): void {
  _messageStore = undefined;
  _searchBackend = undefined;
  _vectorStore = undefined;
  _registry = undefined;
}

/**
 * Inject adapters (for testing only).
 */
export function injectAdapters(adapters: {
  messageStore?: MessageStore;
  searchBackend?: SearchBackend;
  vectorStore?: VectorStore;
}): void {
  if (adapters.messageStore) _messageStore = adapters.messageStore;
  if (adapters.searchBackend) _searchBackend = adapters.searchBackend;
  if (adapters.vectorStore) _vectorStore = adapters.vectorStore;
}
