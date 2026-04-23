# MVP Implementation Plan

## Phases

### Phase 1: Test Foundation [Days 1-2]

- [ ] Configure Vitest with TypeScript path resolution (`@/` alias support)
- [ ] Create test fixture factories: `createMockLLM()`, `createMockEmbedding()`, `createMockSession()`, `createMockDB()`
- [ ] Add `test`, `test:watch`, `test:coverage` scripts to `package.json`
- [ ] Write smoke tests for existing chat route handler (happy path, error path)
- [ ] Write smoke tests for existing search route handler (happy path, error path)
- [ ] Write smoke tests for provider instantiation (OpenAI, Ollama, Custom)
- [ ] Write smoke test for baseSearch flow end-to-end with mocked LLM/embeddings
- [ ] Verify all smoke tests pass against current codebase before refactoring begins

### Phase 2: Search Orchestration Boundaries [Days 3-5]

- [ ] Define port interfaces: `SearchBackend`, `EmbeddingModel`, `ChatModel`, `MessageStore`, `VectorStore`
- [ ] Extract `SearchAgent` orchestration logic from route handler into `ChatService` (application layer)
- [ ] Extract `Researcher` logic into domain service with constructor-injected dependencies
- [ ] Extract `baseSearch` mega-function into `SearchOrchestrator` with explicit step methods
- [ ] Wire chat/search routes to delegate to services instead of calling singletons directly
- [ ] Write unit tests for `ChatService` with mocked `SearchBackend` and `ChatModel`
- [ ] Write unit tests for `SearchOrchestrator` covering: classify → search → select → summarize
- [ ] Write unit tests for `Researcher` domain service with mocked dependencies
- [ ] Verify smoke tests from Phase 1 still pass (regression gate)

### Phase 3: API Route Thinning + Provider Fix [Days 6-8]

- [ ] Create `ApplicationService` base pattern (request validation → domain call → response shaping)
- [ ] Extract remaining chat route logic into `ChatService.handleChat()`
- [ ] Extract remaining search route logic into `SearchService.handleSearch()`
- [ ] Fix `ModelRegistry.updateProvider` bug: replace array entry instead of pushing duplicate
- [ ] Convert `ModelRegistry` to cached singleton (instantiate models once, reuse across requests)
- [ ] Deduplicate provider adapter code (OpenAI/Ollama share embedding call pattern)
- [ ] Write integration tests for `/api/chat` route with mocked service layer
- [ ] Write integration tests for `/api/search` route with mocked service layer
- [ ] Write unit tests for `ModelRegistry` covering: get model, update provider, caching behavior
- [ ] Verify all prior tests still pass

### Phase 4: Verification & Documentation [Days 9-10]

- [ ] Run full regression suite: all existing features exercised manually or via test
- [ ] Verify Docker build produces working image (`docker build` + `docker run` smoke test)
- [ ] Verify Docker Compose stack starts and handles a search query end-to-end
- [ ] Run `tsc --noEmit` — zero type errors
- [ ] Run linter — zero warnings
- [ ] Update architecture documentation to reflect new service boundaries
- [ ] Remove any `// TODO` or `// FIXME` markers introduced during refactoring
- [ ] Final coverage report — confirm ≥80% on new application/domain layers

## Estimation Summary

| Phase | Estimate | Confidence |
|-------|----------|------------|
| Phase 1: Test Foundation | 2 days | High |
| Phase 2: Search Orchestration Boundaries | 3 days | Medium |
| Phase 3: API Route Thinning + Provider Fix | 3 days | Medium |
| Phase 4: Verification & Documentation | 2 days | High |
| **Total** | **10 days** | **Medium** |

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Refactoring breaks existing search/chat behavior | High | Medium | Phase 1 smoke tests gate every subsequent phase; never merge without all prior tests green |
| Circular imports when extracting service layer | Medium | Medium | Define port interfaces first (Phase 2); enforce import direction with a lint rule or architectural test |
| `baseSearch` extraction surfaces hidden coupling | High | Medium | Extract incrementally; keep original function as deprecated wrapper until tests confirm equivalence |
| ModelRegistry singleton breaks streaming responses | High | Low | Test streaming explicitly in Phase 3; singleton holds config references, not response streams |
| Vitest path resolution conflicts with Next.js config | Low | Medium | Use separate `vitest.config.ts` extending `tsconfig.json` paths; test early in Phase 1 |
| Scope creep into frontend state decomposition | Medium | High | Strictly out of scope for MVP; document frontend debt separately, do not touch `useChat.tsx` |
| Docker build breaks due to new file structure | Medium | Low | Phase 4 includes explicit Docker build verification; catch before merge |
| Provider adapter deduplication breaks custom provider | High | Low | Deduplicate only shared patterns; keep custom provider adapter intact with its own tests |
| VectorStore port interface too constraining for future sqlite-vec | Low | Low | Port methods derived from both current JSON-file needs and sqlite-vec KNN API; reviewed against sqlite-vec documentation before finalizing |

## Definition of Done

A user story is Done when ALL of the following are true:

- [ ] All acceptance criteria pass
- [ ] Unit tests cover the new code (≥80% line coverage on changed files)
- [ ] All existing tests (smoke + integration) pass with zero failures
- [ ] `tsc --noEmit` completes with zero errors
- [ ] Linter passes with zero warnings
- [ ] No regressions: existing features (search, chat, upload) behave identically to pre-refactoring
- [ ] No `// TODO`, `// FIXME`, or `// HACK` markers remain in new code
- [ ] Code follows the established layer boundaries (no infrastructure imports in domain layer)
- [ ] Docker build succeeds and produces a working image
- [ ] Changes are reviewed and approved via pull request


## Post-MVP Extensions

The following are explicitly deferred to post-MVP:

- **sqlite-vec integration**: Replace `JsonFileVectorStore` adapter with `SqliteVecVectorStore` for native KNN vector search. The `VectorStore` port defined in Phase 2 enables this swap without domain-layer changes.
- **Frontend state decomposition**: Split `useChat.tsx` god hook into focused hooks (Epic 7)
- **baseSearch split**: Decompose 424-line mega-function into mode-specific strategies (Epic 8)
- **ConfigManager split**: Separate read/write/schema/migration concerns