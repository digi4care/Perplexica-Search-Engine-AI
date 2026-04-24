/**
 * Port interfaces for the search orchestration pipeline.
 *
 * These define the contracts that domain and application layers depend on.
 * Infrastructure adapters implement these interfaces. Zero infrastructure
 * imports allowed in this directory.
 *
 * Patterns used:
 * - Adapter: each port adapts an existing infrastructure class
 * - Strategy: ChatModel, EmbeddingModel, SearchBackend are interchangeable
 * - Repository: MessageStore is a collection-like data access abstraction
 * - Observer: SearchSession is an event subscription model
 *
 * See planning/04-architecture.md for the full hexagonal architecture diagram.
 */

export type { ChatModel } from './chatModel';
export type { EmbeddingModel } from './embeddingModel';
export type { MessageStore, MessageRecord } from './messageStore';
export type { SearchBackend, SearchResult, SearchOptions } from './searchBackend';
export type { VectorStore, VectorSearchResult } from './vectorStore';
export type { SearchSession, SessionEmitter } from './sessionEmitter';
