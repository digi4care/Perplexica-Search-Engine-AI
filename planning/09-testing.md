# Testing Strategy

## Testing Levels

### Unit Tests

- **Scope:** Individual functions, classes, port interfaces, domain services, utility functions
- **Coverage target:** 80% line coverage on new code
- **Framework:** Vitest with TypeScript path alias resolution (`@/`, `@test/`)
- **When:** Written before or alongside production code (TDD preferred for domain logic)
- **Run:** On every commit (pre-push hook); blocks merge on failure
- **Isolation:** All external dependencies replaced with test doubles via constructor injection

### Integration Tests

- **Scope:** Service compositions (ChatService, SearchService, UploadService), API route handlers, repository implementations against real DB, provider adapter wiring
- **Coverage target:** Key service compositions and all API routes covered
- **Framework:** Vitest + supertest-like HTTP helpers for API route testing
- **When:** Written alongside each extracted service; every PR must pass
- **Run:** On every PR; CI job runs full integration suite
- **Isolation:** External services (LLM providers, SearxNG) mocked at the adapter boundary; database tests use in-memory SQLite

### End-to-End (E2E) Tests

- **Scope:** Critical user-facing flows: search query → streamed results, chat conversation → agent loop → response, provider configuration change → verify search works
- **Coverage target:** All critical paths covered; smoke-level depth
- **Framework:** Playwright
- **When:** On merge to main; manually before release
- **Run:** CI pipeline on merge; results gated before marking epic Done
- **Environment:** Docker Compose stack with faked provider endpoints

### Manual Testing

- **Scope:** Full regression verification before marking epic Done; UX verification for streaming behavior, provider switching, upload flow
- **Who:** PO + Tech Lead
- **When:** Before marking any user story or epic as Done
- **Checklist:** Existing feature parity (search, chat, suggestions, uploads), streaming responsiveness, error handling UX, Docker build + run

## Test Pyramid

**70% Unit / 20% Integration / 10% E2E**

```
        ┌─────────┐
        │   E2E   │  10% — critical paths, smoke
        │  (Playwright) │
       ┌┴─────────┴┐
       │Integration │  20% — service compositions, API routes, repos
       │(Vitest+HTTP)│
      ┌┴───────────┴┐
      │    Unit      │  70% — domain logic, utilities, adapters, ports
      │  (Vitest)    │
      └──────────────┘
```

Rationale: Domain logic is the highest-risk, highest-churn surface. Unit tests give the fastest feedback loop for port interfaces, pure functions, and domain services. Integration tests verify wiring without network calls. E2E tests are expensive and slow; reserve for flows where only full-stack exercise catches real bugs.

## What Gets Tested

| User Story / Epic | Unit | Integration | E2E | Manual |
|---|---|---|---|---|
| Epic 1: Test Infrastructure (Vitest setup, fixtures, mocks, CI) | Fixture factories, mock factories return valid objects, coverage config works | CI job runs suite and fails on broken test | N/A (infrastructure) | Verify `pnpm test` works on fresh clone |
| Epic 2: Search Orchestration Boundaries (SearchAgent, Researcher, port interfaces, composition root) | SearchAgent with mocked deps, Researcher domain service, port interface contracts, composition root wiring | Search pipeline end-to-end with faked providers and in-memory repos | Search query returns streamed results through full stack | Verify search results match pre-refactoring behavior |
| Epic 3: API Route Thinning (ChatService, SearchService, ConfigService, route handler pattern) | Service method logic (handleMessage, search, config CRUD), route handler pattern compliance | Route handlers with mocked service layer: parse → validate → call → respond | Chat route streams response, config update persists and applies | Verify all 9+ route handlers follow pattern, no business logic in routes |
| Epic 4: Config & Persistence (ConfigService, ConfigStore, Repository ports, typed events) | ConfigService with MemoryConfigStore, repository interface contracts, typed event emit/subscribe | ConfigStore FilesystemAdapter against real files, Drizzle repository against in-memory SQLite | Config change triggers provider update, search uses new config | Verify Docker config via env vars works |
| Epic 5: Provider & Model Layer (updateProvider fix, caching, adapter normalization, factory) | ModelRegistry update/replace/caching, provider factory validation, adapter contract compliance | Provider instantiation with real SDK configs (no network), cache invalidation on config change | Provider switch mid-session produces correct results | Verify each provider (OpenAI, Ollama, Anthropic, Custom) works |
| Epic 6: Upload Pipeline (DocumentParser, TextChunker, EmbeddingService, UploadService, UploadStore) | Parser per-format, chunker determinism, embedding batch logic, UploadService orchestration, UploadStore interface | Upload pipeline with MemoryUploadStore and mock EmbeddingProvider | File upload produces searchable content in chat | Verify each file type (PDF, DOCX, TXT, PPT, XLS) uploads and is searchable |
| Epic 7: Frontend State Decomposition (useMessages, useStreaming, useFileUpload, useSettings, types) | Each decomposed hook in isolation with mock context, type contracts, ChatContextValue shape | Hook composition produces identical state to monolithic useChat | Full chat UI renders messages, streams, uploads identically | Side-by-side comparison with pre-refactoring UI |
| Epic 8: baseSearch Refactoring (SearchMode interface, Speed/Balanced/Quality strategies, dispatch) | Each mode strategy in isolation, shared utilities (embedding, similarity, dedup), dispatch logic | Full search pipeline per mode with faked providers, mode equivalence to current behavior | Search in each mode returns results matching current quality | A/B comparison of 100 query result sets per mode |

## Test Data & Environments

### Test Fixtures

| Fixture | Purpose | Location |
|---|---|---|
| `createMessage(overrides?)` | Valid Message objects for any test | `@test/fixtures/messages.ts` |
| `createBlock(overrides?)` | Valid Block objects (text, tool_call, etc.) | `@test/fixtures/blocks.ts` |
| `createToolCall(overrides?)` | Valid ToolCall shapes for agent tests | `@test/fixtures/tool-calls.ts` |
| `createConfig(overrides?)` | Valid Config objects with sensible defaults | `@test/fixtures/config.ts` |
| `createSearchResult(overrides?)` | Valid SearchResult for search pipeline tests | `@test/fixtures/search.ts` |

### Test Doubles (Mocks)

| Double | Interface Satisfied | Behavior |
|---|---|---|
| `createMockLLMProvider()` | `LLMProvider` port | Stubbed `generateText`/`streamText` returning fixture data; logs all calls |
| `createMockEmbeddingProvider()` | `EmbeddingProvider` port | Returns fixed-dimension vectors; logs calls |
| `createMockConfigStore()` | `ConfigStore` port | In-memory config CRUD; seedable |
| `createMockMessageRepository()` | `MessageRepository` port | In-memory message CRUD |
| `createMockSearchBackend()` | `SearchBackend` port | Returns fixture search results; simulates SearxNG responses |
| `createMockSessionEmitter()` | `SessionEmitter` port | Captures emitted events in order for assertion |
| `createMockUploadStore()` | `UploadStore` port | In-memory file storage |

### Database

- **Unit tests:** No database; all data access through mock repositories
- **Integration tests:** In-memory SQLite via `better-sqlite3` (`:memory:`); schema applied per-test-suite with Drizzle migrations
- **E2E tests:** Docker Compose stack with real SQLite volume

### CI Environment

- Node.js 20+ on Linux
- Vitest runs with `--pool=forks` for isolation
- Coverage via v8 provider
- Test timeout: 10s unit, 30s integration, 60s E2E
- Parallel test file execution; no shared mutable state between files

## Quality Gates

| Gate | Threshold | Action on Failure |
|---|---|---|
| Line coverage on new code | ≥ 80% | Block merge. Add tests before re-review. |
| Line coverage on refactored modules | ≥ 60% (MVP target), ≥ 80% (post-MVP) | Block merge. Add tests before re-review. |
| Lint errors | 0 | Block merge. Fix all errors. |
| Type errors (`tsc --noEmit`) | 0 | Block merge. Fix all type errors. |
| E2E smoke pass | 100% of critical paths green | Block merge. Investigate and fix. |
| Regression suite | 0 failures on prior tests | Block merge. Never delete or skip a prior test to fix. |
| `any` type usage in domain/application layers | 0 occurrences | Block merge. Replace with proper types. |
| Max file length | 150 lines | Block merge. Split the file. |
| Circular dependencies | 0 detected by `madge --circular` | Block merge. Restructure imports. |
| Test execution time (unit) | < 60 seconds total | Optimize slow tests; avoid I/O in unit tests. |
| Flaky test tolerance | 0 flaky tests | Quarantine and fix before merge. No re-run-to-pass. |
