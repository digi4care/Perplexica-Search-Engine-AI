import SearchAgent from '@/lib/agents/search';
import APISearchAgent from '@/lib/agents/search/api';
import { DrizzleMessageStore, SearxngSearchBackend } from '@/lib/adapters';
import SessionManager from '@/lib/session';
import type { MessageStore, SearchBackend, SearchSession } from '@/lib/ports';

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

// --- Session factory ---

export function createSession(): SearchSession {
  return SessionManager.createSession();
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
}

/**
 * Inject adapters (for testing only).
 */
export function injectAdapters(adapters: {
  messageStore?: MessageStore;
  searchBackend?: SearchBackend;
}): void {
  if (adapters.messageStore) _messageStore = adapters.messageStore;
  if (adapters.searchBackend) _searchBackend = adapters.searchBackend;
}
