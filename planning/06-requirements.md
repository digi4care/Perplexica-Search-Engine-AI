# Requirements

## Functional Requirements

### FR-01: Dependency Injection Container
- **Description:** The system must provide a typed dependency injection container that resolves services by interface, not concrete class. All infrastructure adapters (DB, config, providers, SearxNG) must be injectable and replaceable in tests without monkey-patching module globals.
- **Source:** Architecture epic 3 — ConfigManager god object, DB singleton, untyped SessionManager all rely on module-level mutable state.
- **Priority:** Must
- **Acceptance Criteria:**
  - A container resolves any registered service by its interface token.
  - Tests can override any registration with a stub/mock in a single call.
  - No production code imports a concrete infrastructure class directly; all arrive via constructor injection or container lookup.

### FR-02: Thin API Routes
- **Description:** Every Next.js API route handler must be limited to HTTP concerns (request parsing, response serialization, status codes). All business logic must reside in application-layer use-case services invoked by the route.
- **Source:** Architecture epic 2 — chat/search routes contain business logic and duplicated wiring.
- **Priority:** Must
- **Acceptance Criteria:**
  - No route handler file exceeds 50 lines.
  - No route handler contains domain logic (search orchestration, message formatting, provider selection).
  - Route handlers share zero duplicated wiring code.

### FR-03: Search Pipeline Testability
- **Description:** The search orchestration pipeline (baseSearch 424-line mega-function, SearchAgent, Researcher, Actions) must be decomposed into discrete, composable stages, each independently testable with deterministic stubs for provider calls and SearxNG results.
- **Source:** Architecture epic 1 — untestable monolithic search function.
- **Priority:** Must
- **Acceptance Criteria:**
  - Each pipeline stage (query classification, source retrieval, result aggregation, widget generation, response synthesis) is a pure function or a class with injectable dependencies.
  - A full search pipeline can be exercised end-to-end in a test without network calls.
  - The decomposed pipeline produces identical output for identical input compared to the current pipeline.

### FR-04: Typed Event Emitter
- **Description:** The system must emit strongly-typed events for all streaming outputs (search results, agent actions, widget data, error notifications). Event names and payloads must be defined in a central type map. No `any`-typed event dispatching.
- **Source:** Architecture epic 6 — untyped streaming, inconsistent event shapes.
- **Priority:** Must
- **Acceptance Criteria:**
  - A single `EventMap` type declares every event name and its payload shape.
  - The emitter's `on`, `emit`, and `off` methods are fully typed — subscribing to a non-existent event or mismatched payload is a compile error.
  - All current streaming paths use the typed emitter; no raw string-based event dispatching remains.

### FR-05: Provider Abstraction Layer
- **Description:** AI provider integration must use a unified adapter interface. Each provider (OpenAI, Ollama, Anthropic, Custom) implements the same contract. Provider instantiation happens once per configuration change, not per request.
- **Source:** Architecture epic 4 — ModelRegistry re-instantiates per request, provider code duplication, updateProvider bug.
- **Priority:** Must
- **Acceptance Criteria:**
  - A `ProviderAdapter` interface defines the contract (complete, stream, embed).
  - Adding a new provider requires implementing the interface and registering it — no changes to application or domain layers.
  - Provider instances are cached and reused across requests within the same configuration.
  - The `updateProvider` bug (stale model references) is eliminated by design.

### FR-06: Upload Pipeline Separation
- **Description:** The UploadManager must be decomposed into distinct single-responsibility services: file validation, storage, text extraction, chunking, and embedding. Each service is independently testable.
- **Source:** Architecture epic 5 — UploadManager mixes 5 concerns.
- **Priority:** Must
- **Acceptance Criteria:**
  - Each concern (validation, storage, extraction, chunking, embedding) is a separate class/module with its own interface.
  - The upload orchestrator composes these services; it contains no inline implementation of any concern.
  - Every service can be tested in isolation with mock inputs.

### FR-07: Frontend State Hooks Decomposition
- **Description:** The `useChat.tsx` 848-line god hook must be decomposed into focused, composable hooks, each managing a single slice of state (messages, streaming, suggestions, file uploads, search mode).
- **Source:** Architecture epic 6 — monolithic hook, type chaos.
- **Priority:** Must
- **Acceptance Criteria:**
  - No single custom hook file exceeds 150 lines.
  - Each hook has a single responsibility with a clear input/output contract.
  - The composed behavior is identical to the current monolithic hook from the user's perspective.
  - TypeScript strict mode compiles with zero errors across all hooks.

### FR-08: Type Normalization
- **Description:** All shared types must live in a dedicated domain types module. No types defined inline in route handlers, utility files, or component files. No circular type imports. Zero `any` usage.
- **Source:** Architecture epic 8 — types in wrong files, circular imports, `any`.
- **Priority:** Must
- **Acceptance Criteria:**
  - A `types/` directory contains all shared type definitions organized by domain concept.
  - `grep -r 'any' src/` returns zero matches (excluding node_modules).
  - No circular import cycles detected by static analysis.
  - Every exported type has a single canonical definition location.

### FR-09: Test Infrastructure
- **Description:** The project must have a complete test infrastructure: unit test runners, integration test helpers (mock providers, in-memory DB, fake SearxNG), and e2e smoke tests for critical paths (search, chat, upload).
- **Source:** Architecture epic 7 — zero tests → full coverage.
- **Priority:** Must
- **Acceptance Criteria:**
  - `npm test` runs unit, integration, and e2e suites with clear pass/fail output.
  - Test helpers provide deterministic mocks for every external dependency (LLM providers, SearxNG, filesystem, SQLite).
  - CI pipeline runs the full suite on every PR.

### FR-10: API Backward Compatibility
- **Description:** The existing API contract (`/api/search`, `/api/chat`) must continue to work identically for all current consumers. Request and response shapes must not change. Streaming behavior must not change.
- **Source:** Business need — existing integrations and frontends depend on current API shape.
- **Priority:** Must
- **Acceptance Criteria:**
  - All existing API endpoints accept the same request schemas and return the same response schemas.
  - Existing streaming SSE format is preserved byte-for-byte for the same inputs.
  - No API endpoint URL, method, or header contract changes.

### FR-11: Configuration Migration
- **Description:** Configuration must be migrated from the current ConfigManager god object to a layered configuration system (defaults → file → env vars → runtime overrides) with typed access and validation.
- **Source:** Architecture epic 3 — ConfigManager mixes loading, validation, access, and mutation.
- **Priority:** Must
- **Acceptance Criteria:**
  - Configuration values are accessed via a typed interface with no `any`.
  - Invalid configuration fails fast with a descriptive error at startup, not at runtime.
  - Configuration can be fully overridden via environment variables for Docker deployments.
  - All current configuration keys are supported with the same semantics.

### FR-12: Streaming Preservation
- **Description:** The refactored system must preserve the current streaming behavior: real-time token-by-token response delivery via SSE, progressive search result display, and intermediate status updates.
- **Source:** Business need — streaming is a core UX feature.
- **Priority:** Must
- **Acceptance Criteria:**
  - Streamed responses are delivered to the client with no additional latency compared to the current baseline.
  - All current SSE event types are emitted at the same points in the workflow.
  - Stream interruption and error propagation behave identically to current behavior.

### FR-13: Session Management Typing
- **Description:** Session management must use a typed session interface. Session data shapes must be defined, validated on read/write, and free of `any`-typed access patterns.
- **Source:** Architecture epic 3 — untyped SessionManager.
- **Priority:** Should
- **Acceptance Criteria:**
  - Session read/write operations are fully typed — accessing a non-existent key is a compile error.
  - Session data is validated against a schema on deserialization.
  - No `any` in session-related code.

### FR-14: Domain Layer Isolation
- **Description:** Domain logic (search orchestration, agent loop, classifier, widget generation) must have zero imports from infrastructure or presentation layers. Domain types define the contracts; infrastructure implements adapters.
- **Source:** Clean/hexagonal architecture target.
- **Priority:** Must
- **Acceptance Criteria:**
  - `src/domain/` has no imports from `src/infrastructure/` or `src/presentation/`.
  - Domain modules depend only on other domain modules or on interfaces defined within domain.
  - All external integrations are accessed through ports (interfaces) defined in domain.

### FR-15: Error Boundary Standardization
- **Description:** All layers must use a consistent error hierarchy. Domain errors, infrastructure errors, and presentation errors must be distinguishable. Error propagation must be explicit — no swallowed errors, no `any`-typed catch blocks.
- **Source:** Cross-cutting concern — inconsistent error handling across epics.
- **Priority:** Should
- **Acceptance Criteria:**
  - A base `AppError` class with domain/infrastructure/presentation subtypes.
  - No bare `catch (e)` with untyped `e` — all catch blocks use typed error discrimination.
  - Every error reaching an API route has a corresponding HTTP status code mapping.

### FR-16: VectorStore Abstraction
- **Description:** Embedding storage and similarity search must be abstracted behind a `VectorStore` port interface. The current JSON-file storage becomes the first adapter. This enables future migration to sqlite-vec or other vector databases without modifying domain or application layers.
- **Source:** Architecture decision — sqlite-vec as post-MVP, VectorStore port from day 1.
- **Priority:** Should
- **Acceptance Criteria:**
  - A `VectorStore` port interface defines `upsert`, `query`, and `delete` methods with typed signatures.
  - `JsonFileVectorStore` adapter wraps current JSON-file embedding storage without behavior change.
  - No domain or application module imports filesystem paths or JSON-file logic for embeddings directly.
  - A test with `MemoryVectorStore` works without filesystem access.

## Non-Functional Requirements

### Performance

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Search response p95 latency | ≤ current baseline p95 | Load test with identical query set before/after |
| Streaming first-token latency | ≤ current baseline | Measure time-to-first-SSE-token in e2e test |
| Memory usage (idle) | ≤ current baseline + 10% | Docker stats during idle period |
| Memory usage (peak, 10 concurrent searches) | ≤ current baseline + 15% | Load test with p95 memory monitoring |
| Cold start time | ≤ current baseline + 5% | Measure from container start to first successful request |
| Upload processing throughput | ≥ current baseline files/minute | Process identical document set before/after |

### Reliability

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Existing feature parity | 100% — no regressions | Manual + automated smoke test suite |
| Search result quality | Identical ranking for identical queries | A/B comparison of 100 query result sets |
| Data integrity | Zero data loss during migration | Verify all existing sessions/configs survive refactor |
| Error recovery | All transient errors retried with backoff | Integration test with injected failures |
| Graceful degradation | Search works when individual providers are down | Test with each provider independently unavailable |

### Security

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| New attack surface | Zero new endpoints, zero new privilege escalation paths | Security review of all new code paths |
| Input validation | All API inputs validated against schema before processing | Automated check: every route has schema validation |
| Dependency injection exposure | DI container not accessible from request context | Static analysis: no container reference in route handlers |
| Secret handling | No secrets in source code or client bundles | grep for API key patterns; review build output |
| SQL injection | Zero raw SQL strings — all queries via Drizzle ORM | Static analysis for raw SQL usage |

### Scalability

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Concurrent search sessions | ≥ current baseline | Load test ramping concurrent users |
| Provider failover | < 2s detection and switch to alternate provider | Integration test with provider kill |
| Configuration reload | Zero-downtime config changes | Runtime config update during active searches |

### Usability

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Developer onboarding | New contributor can run full test suite in < 5 minutes | Fresh clone → `npm test` timing |
| Code navigation | Any file reachable from entry point in ≤ 3 hops | Dependency graph depth analysis |
| Error messages | All runtime errors include actionable context | Audit error messages for clarity |

### Maintainability

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Test coverage on new code | ≥ 80% line coverage | `npm test -- --coverage` |
| `any` type usage | 0 occurrences | `grep -r 'any' src/` returns zero |
| Max file length | 150 lines | Linter rule enforced in CI |
| Max function length | 10 lines (excluding signatures) | Linter rule enforced in CI |
| Circular dependencies | 0 | `madge --circular src/` returns zero |
| Cyclomatic complexity per function | ≤ 10 | Linter rule enforced in CI |
| Dependency count | No increase in production dependencies | Compare `package.json` dependency lists |

## Data Requirements

| Requirement | Detail |
|-------------|--------|
| Schema migration | All existing SQLite schemas must be preserved; new columns additive only |
| Data backward compatibility | Existing chat history, sessions, and uploaded documents must remain accessible |
| Configuration migration | Current config file format must be auto-migratable to new typed format |
| No data loss | Zero records lost during refactoring — migration must be reversible |

## Integration Requirements

| Integration | Requirement |
|-------------|-------------|
| SearxNG | Adapter interface must isolate SearxNG-specific API details; testable without running instance |
| LLM Providers (OpenAI, Ollama, Anthropic, Custom) | Each behind provider adapter; mockable in all test layers |
| Next.js | Routes remain Next.js App Router handlers; no framework migration |
| Docker | Existing Dockerfile and docker-compose must continue to work |
| Frontend | No changes required to component API contracts; state hooks are internal refactoring |

## Constraints

| Constraint | Detail |
|------------|--------|
| Language | TypeScript strict mode (`strict: true`) — no escape hatches |
| Framework | Next.js — no migration to alternative framework |
| Runtime | Node.js — no change to runtime environment |
| Database | SQLite via Drizzle ORM — no database engine change |
| Containerization | Docker compatibility must be preserved |
| Breaking changes | Zero breaking changes to public API endpoints |
| Timeline | Each epic must be independently deployable — no big-bang cutover |
| Dependencies | No new production dependencies unless justified by a 2:1 reduction in custom code |
| File size | Maximum 150 lines per file, enforced by linter |
| Function size | Maximum 10 lines per function body, enforced by linter |
| VectorStore | VectorStore port interface from day 1; sqlite-vec integration deferred to post-MVP |
