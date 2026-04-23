# User Stories

## Epic 1: Test Infrastructure

### US-1.1: Vitest Project Setup
**As a** developer, **I want to** run `vitest` and see a passing test suite **so that** I can write and run tests for any module without fighting configuration.

**Acceptance Criteria:**
- Given a fresh clone, When I run `pnpm test`, Then Vitest executes and reports results with zero config errors
- Given a TypeScript source file, When I create a co-located `.test.ts` file, Then Vitest discovers and runs it
- Given the test runner, When I import a module using `@/` path aliases, Then resolution works without manual mocking
- Coverage reporting is configured via `--coverage` flag using v8 provider

**Priority:** Must
**Estimate:** S

### US-1.2: Test Fixtures and Factory Helpers
**As a** developer, **I want to** import factory functions for domain objects (Message, Block, ToolCall, Config) **so that** I can write tests with realistic data without hand-building each fixture.

**Acceptance Criteria:**
- Given a test file, When I import from `@test/fixtures`, Then I have access to `createMessage`, `createBlock`, `createToolCall`, `createConfig` factories
- Each factory accepts partial overrides and fills required defaults
- Fixtures produce valid objects that pass runtime Zod validation where applicable

**Priority:** Must
**Estimate:** S

### US-1.3: Mocking Utilities for Infrastructure Adapters
**As a** developer, **I want to** import pre-built test doubles for DB, filesystem, SearxNG, and LLM providers **so that** I can test domain and application layers without external dependencies.

**Acceptance Criteria:**
- Given a domain test, When I import `createMockLLMProvider`, Then it returns an object satisfying the `LLMProvider` port with stubbed `generateText`/`streamText`
- Given a service test, When I import `createMockConfigStore`, Then it returns an in-memory `ConfigStore` implementation
- Given a service test, When I import `createMockMessageRepository`, Then it returns an in-memory `MessageRepository` with CRUD operations
- Mocks log calls for assertion without manual spy setup

**Priority:** Must
**Estimate:** M

### US-1.4: CI Test Integration
**As a** maintainer, **I want to** run the full test suite in CI on every pull request **so that** regressions are caught before merge.

**Acceptance Criteria:**
- Given a pull request, When CI runs, Then the test job executes `vitest --run` and fails the pipeline on any test failure
- Given a push to main, When CI runs, Then coverage report is generated and artifact-uploaded
- Test job runs in under 60 seconds for unit tests

**Priority:** Should
**Estimate:** S

### US-1.5: Integration Test Harness for Search Pipeline
**As a** developer, **I want to** write integration tests that exercise the search agent loop end-to-end with faked providers **so that** I can verify orchestration correctness without real network calls.

**Acceptance Criteria:**
- Given an integration test, When I construct a `SearchAgent` with mock providers, Then the agent loop executes tool calls and returns a composed response
- The harness captures streamed events in order for assertion
- A single test validates the classify-research-write cycle without real SearxNG or LLM

**Priority:** Should
**Estimate:** M

---

## Epic 2: Search Orchestration Boundaries

### US-2.1: Extract SearchAgent Domain Logic from Infrastructure
**As a** developer, **I want to** instantiate a `SearchAgent` by passing dependencies through its constructor **so that** I can test search orchestration without real DB, session, or LLM connections.

**Acceptance Criteria:**
- Given a test, When I construct `new SearchAgent({ llmProvider, messageRepo, sessionEmitter })`, Then the agent runs without importing singletons
- `SearchAgent` has zero direct imports of `ConfigManager`, `SessionManager`, or database client modules
- Existing search functionality is preserved: the chat route produces identical streamed responses

**Priority:** Must
**Estimate:** L

### US-2.2: Define and Implement Search-Agent Port Interfaces
**As a** developer, **I want to** see explicit port interfaces for all SearchAgent dependencies **so that** I know the exact contract the agent requires from infrastructure.

**Acceptance Criteria:**
- Given the domain layer, When I inspect `SearchAgent` constructor parameters, Then each is typed as a port interface (`LLMProvider`, `MessageRepository`, `SessionEmitter`, `SearchBackend`)
- Port interfaces live in the domain layer with zero infrastructure imports
- Each port has at least one infrastructure adapter implementation

**Priority:** Must
**Estimate:** M

### US-2.3: Decouple Researcher from Direct Database Access
**As a** developer, **I want to** pass repository interfaces to the `Researcher` instead of it importing DB directly **so that** I can test research actions with in-memory data.

**Acceptance Criteria:**
- Given `Researcher` source, When I search for direct imports of Drizzle or `better-sqlite3`, Then there are zero matches
- Given a test, When I pass a mock `MessageRepository` to Researcher, Then research actions execute without a real database
- All research actions (webSearch, academicSearch, socialSearch) continue to function end-to-end

**Priority:** Must
**Estimate:** M

### US-2.4: Remove SessionManager Singleton from Search Pipeline
**As a** developer, **I want to** pass a typed `SessionEmitter` through the search pipeline instead of importing the `SessionManager` singleton **so that** event streaming is testable and type-safe.

**Acceptance Criteria:**
- Given the search pipeline files, When I search for `import SessionManager`, Then zero matches in domain/application layers
- Given a `SessionEmitter` port, When I inspect its interface, Then all event types are named and typed (no stringly-typed event names)
- Given a test, When I capture events from a mock `SessionEmitter`, Then I can assert event order and payload types at compile time

**Priority:** Must
**Estimate:** M

### US-2.5: Wire Search Dependencies in Composition Root
**As a** maintainer, **I want to** see all search-pipeline dependency wiring in a single composition root **so that** I can trace the full dependency graph without reading every module.

**Acceptance Criteria:**
- Given the codebase, When I search for `new SearchAgent`, Then it appears in exactly one location (the composition root or service factory)
- Given the composition root, When I read it, Then I can see all adapter → port bindings for the search pipeline
- Changing a provider implementation requires editing only the composition root and the adapter, not the domain

**Priority:** Should
**Estimate:** S

---

## Epic 3: API Route Thinning

### US-3.1: Extract ChatService from Chat Route Handler
**As a** developer, **I want to** call `chatService.handleMessage(request)` from the chat route **so that** business logic is testable independently of the HTTP layer.

**Acceptance Criteria:**
- Given `src/app/api/chat/route.ts`, When I count lines, Then it is under 50 lines (deserialize → call service → serialize)
- Given `ChatService.handleMessage`, When I call it with a typed request object in a test, Then it orchestrates search, streaming, and message persistence without a Next.js request object
- The streaming response behavior is identical to the current implementation

**Priority:** Must
**Estimate:** L

### US-3.2: Extract SearchService from Search Route Handler
**As a** developer, **I want to** call `searchService.search(query, options)` from the search route **so that** search orchestration logic is decoupled from HTTP handling.

**Acceptance Criteria:**
- Given `src/app/api/search/route.ts`, When I inspect it, Then it contains only request parsing, service call, and response serialization
- `SearchService` accepts injected dependencies (providers, config, session emitter) via constructor
- Search results streamed to the client are identical to current behavior

**Priority:** Must
**Estimate:** M

### US-3.3: Extract ConfigService from Config Route Handlers
**As a** developer, **I want to** call `configService.get()` / `configService.updateProviders()` from config routes **so that** config CRUD logic is centralized and testable.

**Acceptance Criteria:**
- Given `src/app/api/config/route.ts`, When I inspect it, Then it delegates to `ConfigService` methods
- `ConfigService` accepts a `ConfigStore` port, enabling in-memory config for tests
- Provider CRUD operations (add, update, delete, list) are methods on `ConfigService`, not inline route logic

**Priority:** Should
**Estimate:** M

### US-3.4: Eliminate Duplicate ModelRegistry Instantiation Across Routes
**As a** maintainer, **I want to** see ModelRegistry created once per request lifecycle and injected into services **so that** I stop re-reading config and re-initializing providers on every handler call.

**Acceptance Criteria:**
- Given all API route files, When I search for `new ModelRegistry()`, Then zero matches in route handlers
- The registry is created in a request-scoped factory or middleware and passed to services
- Given a single request, When it hits multiple services, Then the same registry instance is reused

**Priority:** Must
**Estimate:** S

### US-3.5: Standardize Route Handler Pattern
**As a** developer, **I want to** see a consistent pattern across all route handlers (parse → validate → call service → respond) **so that** I can add a new endpoint by following the same structure.

**Acceptance Criteria:**
- Given all 9+ route handlers, When I read any one, Then it follows: (1) parse request body/params, (2) validate with Zod, (3) call application service, (4) return typed response
- No route handler contains direct calls to Drizzle, filesystem, or provider SDKs
- A shared `apiResponse` helper handles success/error serialization consistently

**Priority:** Should
**Estimate:** S

---

## Epic 4: Config & Persistence Layer

### US-4.1: Split ConfigManager into ConfigService + ConfigStore Port
**As a** developer, **I want to** inject a `ConfigStore` implementation into `ConfigService` **so that** I can use in-memory config in tests and filesystem config in production.

**Acceptance Criteria:**
- Given `ConfigService`, When I inspect its constructor, Then it accepts a `ConfigStore` port (not a file path)
- Given the `ConfigStore` port interface, When I inspect it, Then it defines `load()`, `save()`, and schema-versioning methods
- The current JSON-file behavior is preserved via a `FilesystemConfigStore` adapter
- Given a test, When I pass a `MemoryConfigStore`, Then config reads/writes work without touching the filesystem

**Priority:** Must
**Estimate:** M

### US-4.2: Replace Database Singleton with Repository Ports
**As a** developer, **I want to** pass repository interfaces (`MessageRepository`, `ChatRepository`) to services **so that** I can test with in-memory stores.

**Acceptance Criteria:**
- Given any service or domain module, When I search for direct imports of `better-sqlite3` or Drizzle client, Then zero matches in domain/application layers
- Given `MessageRepository` port, When I inspect it, Then it defines `save`, `findById`, `findByChatId`, `delete` methods with typed signatures
- Drizzle-based implementations live in the infrastructure layer only
- Existing DB queries produce identical results through the repository layer

**Priority:** Must
**Estimate:** L

### US-4.3: Typed Session Event System
**As a** developer, **I want to** emit and subscribe to typed session events **so that** compile-time checking prevents misspelled event names and wrong payload shapes.

**Acceptance Criteria:**
- Given the `SessionEmitter` interface, When I call `emit('messageChunk', payload)`, Then the payload type is enforced at compile time
- Given a listener, When I subscribe with `on('researchUpdate', handler)`, Then the handler parameter is typed to match the event
- The untyped `EventEmitter` usage in the current `SessionManager` is fully replaced
- Stringly-typed event names (`emit('data', ...)`) no longer exist in the codebase

**Priority:** Must
**Estimate:** M

### US-4.4: Remove ConfigManager Singleton Export
**As a** maintainer, **I want to** remove the module-level `const configManager = new ConfigManager()` export **so that** no module can accidentally import the global singleton.

**Acceptance Criteria:**
- Given the entire codebase, When I search for `import configManager` or `from '../config'` (singleton import), Then zero matches
- All former import sites receive config through constructor injection
- The application bootstrapper creates and wires the single config instance once at startup

**Priority:** Must
**Estimate:** S

---

## Epic 5: Provider & Model Layer

### US-5.1: Fix ModelRegistry updateProvider Bug
**As a** maintainer, **I want to** call `registry.updateProvider(id, config)` and have it replace the existing provider entry **so that** duplicate providers do not accumulate.

**Acceptance Criteria:**
- Given a registry with provider "openai", When I call `updateProvider("openai", newConfig)`, Then the registry contains exactly one "openai" entry with the new config
- Given a test that calls `updateProvider` three times on the same provider ID, Then the registry size does not grow beyond the original count
- A regression test exists that fails if `push` is used instead of replace

**Priority:** Must
**Estimate:** S

### US-5.2: Add Provider Caching to ModelRegistry
**As a** developer, **I want to** reuse provider instances across requests **so that** I avoid re-initializing SDK clients on every call.

**Acceptance Criteria:**
- Given two sequential service calls, When both request the same provider, Then the same provider instance is returned (referential identity)
- Given a provider config change, When `updateProvider` is called, Then the cache entry is invalidated and a fresh instance is created
- Cache lifecycle is scoped to the registry lifetime (application-scoped, not per-request)

**Priority:** Must
**Estimate:** M

### US-5.3: Normalize Provider Adapter Implementations
**As a** developer, **I want to** see all 8 provider implementations follow the same structural pattern **so that** adding a 9th provider is a mechanical task.

**Acceptance Criteria:**
- Given any provider adapter directory, When I inspect it, Then it exports a class implementing the `LLMProvider` port with `generateText`, `streamText`, `generateObject`, `streamObject`
- Given any embedding adapter, When I inspect it, Then it implements the `EmbeddingProvider` port with `embed` and `embedBatch`
- Provider-specific error handling normalizes to domain error types
- No provider adapter imports domain or application layer modules

**Priority:** Should
**Estimate:** M

### US-5.4: Provider Factory with Type-Safe Configuration
**As a** developer, **I want to** create provider instances via a factory that validates provider-specific config at creation time **so that** misconfiguration fails fast with a clear error message.

**Acceptance Criteria:**
- Given a provider config with missing required fields, When I call `createProvider('openai', config)`, Then it throws a Zod validation error naming the missing fields
- Given a valid config, When I call `createProvider`, Then I get a typed `LLMProvider` instance
- The factory is the single point of provider instantiation — no `new OpenAIProvider()` calls outside it

**Priority:** Should
**Estimate:** S

---

## Epic 6: Upload Pipeline

### US-6.1: Separate File Parsing from UploadManager
**As a** developer, **I want to** call a `DocumentParser.parse(file)` function that returns raw text **so that** parsing logic is independently testable and extensible to new file formats.

**Acceptance Criteria:**
- Given a PDF file, When I call `DocumentParser.parse(buffer, 'application/pdf')`, Then I get extracted text without any embedding or database operations
- Given an unsupported MIME type, When I call `parse`, Then it throws a descriptive `UnsupportedFileTypeError`
- Parsing for PDF, DOCX, TXT, PPT, and XLS is handled by format-specific strategies, not conditionals

**Priority:** Must
**Estimate:** M

### US-6.2: Extract Chunking Strategy into Testable Module
**As a** developer, **I want to** call `chunker.split(text, options)` and get deterministic chunks **so that** I can test chunking logic without running the full upload pipeline.

**Acceptance Criteria:**
- Given 10,000 characters of text, When I call `chunker.split(text, { maxChunkSize: 1000, overlap: 100 })`, Then I get an array of string chunks each under 1000 characters
- Chunk boundaries respect sentence/paragraph boundaries where possible
- Chunking is pure: same input always produces same output, no side effects
- Existing `splitText` utility is replaced or consolidated

**Priority:** Must
**Estimate:** S

### US-6.3: Extract Embedding Pipeline as Standalone Service
**As a** developer, **I want to** call `embeddingService.embedBatch(chunks)` with an injected provider **so that** embedding generation is decoupled from upload orchestration.

**Acceptance Criteria:**
- Given an array of text chunks and a mock `EmbeddingProvider`, When I call `embedBatch`, Then each chunk gets a vector without filesystem or database access
- Batch size is configurable and respects provider limits
- Failed embeddings are reported per-chunk without aborting the entire batch
- The embedding service stores vectors via a `VectorStore` port, not directly to filesystem

**Priority:** Should
**Estimate:** M

### US-6.4: UploadService Orchestrates Pipeline Stages
**As a** developer, **I want to** call `uploadService.process(file)` which delegates to parser → chunker → embedder → store **so that** each stage is swappable and the pipeline is visible.

**Acceptance Criteria:**
- Given `UploadService`, When I inspect its constructor, Then it accepts `DocumentParser`, `TextChunker`, `EmbeddingService`, `UploadStore`, `UploadRepository`, and `VectorStore` as dependencies
- Given a valid file upload, When `process` completes, Then the file is stored, chunks are embedded, and records are persisted
- Given a failure at any stage, When `process` runs, Then previous stages' artifacts are cleaned up (no orphan files or partial records)

**Priority:** Must
**Estimate:** L

### US-6.5: UploadStore Port Abstracts File I/O
**As a** developer, **I want to** pass an `UploadStore` implementation to `UploadService` **so that** tests use in-memory storage and production uses the filesystem.

**Acceptance Criteria:**
- Given the `UploadStore` port interface, When I inspect it, Then it defines `save`, `read`, `delete`, and `list` methods
- The current filesystem implementation moves to infrastructure without behavior change
- Given a test with `MemoryUploadStore`, When I save and read a file, Then it works without touching disk
- The current JSON-file embedding storage is wrapped in a `JsonFileVectorStore` adapter implementing the `VectorStore` port

**Priority:** Should
**Estimate:** S

### US-6.6: VectorStore Port for Embedding Search
**As a** developer, **I want to** inject a `VectorStore` implementation for similarity search **so that** embedding storage is swappable and the current JSON-file approach can be replaced by sqlite-vec without touching domain logic.

**Acceptance Criteria:**
- Given the `VectorStore` port interface, When I inspect it, Then it defines `upsert(docId: string, chunks: ChunkEmbedding[]): Promise<void>`, `query(embedding: number[], topK: number): Promise<SearchResult[]>`, `delete(docId: string): Promise<void>`
- Given `JsonFileVectorStore`, When I call `query` with an embedding, Then it returns results using the current brute-force similarity algorithm
- Given a test with `MemoryVectorStore`, When I upsert and query embeddings, Then it works without filesystem access
- Post-MVP: `SqliteVecVectorStore` implements the same interface for native KNN search

**Priority:** Should
**Estimate:** M

---

## Epic 7: Frontend State Decomposition

### US-7.1: Extract useMessages Hook from useChat
**As a** developer, **I want to** import `useMessages` from its own module **so that** message state management is testable and replaceable independently of streaming or file uploads.

**Acceptance Criteria:**
- Given `useMessages`, When I inspect it, Then it manages message list state, message appending, block patching, and message ordering
- Given `useChat`, When I inspect it, Then it composes `useMessages` and does not contain `useState` calls for message state directly
- Chat UI renders identically: message list, block updates, and message ordering are preserved

**Priority:** Must
**Estimate:** L

### US-7.2: Extract useStreaming Hook from useChat
**As a** developer, **I want to** import `useStreaming` that manages SSE connection and chunk assembly **so that** streaming logic is isolated from other chat concerns.

**Acceptance Criteria:**
- Given `useStreaming`, When I inspect it, Then it owns the EventSource connection, chunk buffering, and stream error state
- Given `useChat`, When streaming starts, Then it delegates to `useStreaming.startStream(url)` and receives assembled responses
- The progressive message rendering (blocks appearing incrementally) is unchanged

**Priority:** Must
**Estimate:** M

### US-7.3: Extract useFileUpload and useSettings Hooks
**As a** developer, **I want to** import `useFileUpload` and `useSettings` as separate hooks **so that** upload and settings concerns don't mix with message management.

**Acceptance Criteria:**
- Given `useFileUpload`, When I inspect it, Then it manages file selection, upload progress, and file-to-message binding
- Given `useSettings`, When I inspect it, Then it manages provider selection, config readiness, and model preferences
- Given `useChat`, When I inspect it, Then `useState` count is under 6 (down from 16)
- All existing UI features (file upload flow, provider switching) work identically

**Priority:** Must
**Estimate:** M

### US-7.4: Fix Type Locations and Eliminate Circular Imports
**As a** developer, **I want to** import `Section`, `Message`, `Block`, and context types from shared type modules **so that** I stop seeing circular-import errors and `any` types.

**Acceptance Criteria:**
- Given `src/lib/types/`, When I inspect it, Then all shared types (`Section`, `Message`, `Block`, `ToolCall`, `ChatContextValue`) are exported from dedicated type files
- Given component files, When I search for `type` or `interface` definitions, Then zero domain types are defined inline in component files
- Given the TypeScript compiler, When I run `tsc --noEmit`, Then zero circular-import warnings
- No shared type is typed as `any`

**Priority:** Must
**Estimate:** M

### US-7.5: Type the ChatContextValue Interface
**As a** developer, **I want to** see a declared `ChatContextValue` interface with all 28 context values **so that** IDE autocomplete works and missing values are caught at compile time.

**Acceptance Criteria:**
- Given the context provider, When I inspect `createContext`, Then it is typed with `ChatContextValue` (not inferred from an inline object)
- Given `ChatContextValue`, When I add a new context value, Then TypeScript errors in all consumers that destructure the context until they acknowledge it
- The 28-value context is split: each decomposed hook contributes its own typed slice

**Priority:** Should
**Estimate:** S

---

## Epic 8: baseSearch Refactoring

### US-8.1: Define SearchMode Strategy Interface
**As a** developer, **I want to** see a `SearchMode` interface with a `execute(query, sources)` method **so that** each search mode is a standalone, testable strategy.

**Acceptance Criteria:**
- Given the domain layer, When I inspect `SearchMode`, Then it defines `execute(query: string, sources: SearchResult[], deps: SearchDependencies): Promise<SearchOutput>`
- Each mode (speed, balanced, quality) implements this interface
- The interface lives in the domain layer with zero infrastructure imports

**Priority:** Must
**Estimate:** S

### US-8.2: Extract Speed Search Mode Strategy
**As a** developer, **I want to** run the speed search mode in isolation **so that** I can test its chunking/embedding/ranking logic without triggering balanced or quality branches.

**Acceptance Criteria:**
- Given `SpeedSearchMode`, When I call `execute(query, sources, deps)` in a test with mock dependencies, Then it returns ranked results using speed-mode logic
- Given `SpeedSearchMode` source, When I search for conditional branches that check mode === 'balanced' or mode === 'quality', Then there are zero matches
- Existing speed-mode behavior (minimal chunking, fast ranking) is preserved

**Priority:** Must
**Estimate:** M

### US-8.3: Extract Balanced and Quality Search Mode Strategies
**As a** developer, **I want to** run balanced and quality modes as independent classes **so that** modifying quality-mode ranking never touches speed-mode code.

**Acceptance Criteria:**
- Given `BalancedSearchMode` and `QualitySearchMode` classes, When I inspect each, Then each contains only the logic for its own mode
- Given the full test suite, When I test each mode with the same query and sources, Then results match the current behavior for that mode
- Adding a hypothetical fourth mode requires creating one new class and registering it — zero edits to existing modes

**Priority:** Must
**Estimate:** M

### US-8.4: Replace Mega-Function with Strategy Dispatch
**As a** maintainer, **I want to** see `executeSearch` delegate to a mode-specific strategy **so that** the function body is a simple lookup and dispatch, not 400 lines of interleaved branching.

**Acceptance Criteria:**
- Given `executeSearch`, When I count its lines, Then it is under 30 lines (resolve mode → validate → delegate to strategy → return result)
- Given the callers (webSearch, academicSearch, socialSearch), When I trace their calls, Then behavior is identical to the current implementation
- The mode-strategy registry is extensible: registering a new mode is a single entry, not an `else if` branch
- `baseSearch.ts` no longer contains `if (mode === 'speed')` style conditionals

**Priority:** Must
**Estimate:** L

### US-8.5: Shared Search Utilities for Cross-Mode Logic
**As a** developer, **I want to** import shared search helpers (embedding, similarity scoring, source deduplication) from a common module **so that** mode strategies don't duplicate shared logic.

**Acceptance Criteria:**
- Given any two mode strategies, When I compare their source, Then shared operations (embed query, compute similarity, deduplicate sources) call the same utility functions
- Shared utilities are pure functions with no side effects, testable in isolation
- The existing `computeSimilarity` and `splitText` utilities are consolidated into this module

**Priority:** Should
**Estimate:** S

---

## Backlog (Unordered)

- **US-B1: Discover/Search Route Service Extraction** — The `discover` and `weather` routes contain inline orchestration similar to the main search route. Extract into `DiscoverService` following the same pattern as `SearchService`.
- **US-B2: Widget Executor Port Interface** — Weather and stock widgets reach external APIs directly. Define a `WidgetDataProvider` port so widgets can be tested with fixture data.
- **US-B3: Graceful Provider Failover** — When a provider call fails, the agent should retry with backoff or fall back to an alternate provider. Currently fails without recovery.
- **US-B4: Health-Check Endpoint** — Expose a `/api/health` endpoint that verifies DB, config, SearxNG, and at least one provider are reachable. Blocked until ConfigManager singleton is removed.
- **US-B5: Suggestion Service Extraction** — The suggestions route mixes model loading with prompt construction. Extract into `SuggestionService` following the route-thinning pattern.
- **US-B6: Frontend Test Setup (RTL + Testing Library)** — Once hooks are decomposed, set up React Testing Library to unit-test individual hooks with mock providers.
- **US-B7: E2E Test Suite with Playwright** — After architectural boundaries are in place, add Playwright tests for the full chat → search → response flow.
- **US-B8: Streaming Protocol Versioning** — Typed SSE envelopes should carry a protocol version so the frontend can handle backward-compatible changes gracefully.
- **US-B9: Database Migration Strategy** — Once repository ports are in place, add versioned migrations via Drizzle instead of manual schema changes.
- **US-B10: Embedding Cache Layer** — Cache embedding results for identical text chunks to avoid redundant provider calls during re-upload or similar documents.
