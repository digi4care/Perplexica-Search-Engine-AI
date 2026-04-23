# Design Log

## Risk Register

| # | Risk | Impact | Likelihood | Status | Mitigation | Owner |
|---|------|--------|------------|--------|------------|-------|
| 1 | Breaking existing search/chat functionality during refactor | High | Medium | Mitigating | Port/adaptor pattern with integration tests run against real providers before each milestone | Dev |
| 2 | Framework constraints blocking clean DI patterns | Medium | Medium | Open | Identify Next.js/App Router coupling early; isolate framework calls behind thin wrappers | Dev |
| 3 | Scope creep from adding features during refactor | High | High | Mitigating | Strict MVP scope in planning docs; feature requests deferred to post-MVP backlog | Lead |
| 4 | Performance regression from DI overhead | Low | Low | Monitoring | Benchmark critical paths (search latency, streaming) before and after each refactor phase | Dev |
| 5 | Provider implementations diverging after refactor | Medium | Medium | Open | Shared provider interface contract + compliance tests; abstract base class for common logic | Dev |
| 6 | Test mocks not matching real provider behavior | High | Medium | Open | Contract tests against live providers in CI; mock factories derived from real response schemas | Dev |
| 7 | Frontend decomposition breaking streaming UI | High | Medium | Open | Streaming integration tests; keep streaming path working at every commit via E2E smoke test | Dev |
| 8 | Migration path for existing config/DB data | Medium | Low | Open | Backward-compatible config loader; migration scripts tested against sample data before release | Dev |

---

## 2026-04-23 — Hexagonal Architecture over Layered

**Context:** The current codebase mixes domain logic with infrastructure concerns (SearXNG calls, LLM provider invocation, WebSocket handling) inside the same modules. This makes testing require real external services and makes swapping providers invasive.

**Options Considered:**
1. **Layered architecture** — traditional three-tier (presentation → business → data). Simpler but allows domain logic to leak into data/presentation layers over time.
2. **Hexagonal architecture (ports & adaptors)** — domain core depends on nothing; all external interaction flows through ports (interfaces) implemented by adaptors.
3. **Clean Architecture** — stricter concentric circles with use-case-level indirection. Heavier ceremony for the current team size.

**Decision:** Hexagonal architecture.

**Rationale:** Hexagonal gives clearer boundaries than layered without the ceremony overhead of full Clean Architecture. Ports make provider swapping and test doubles explicit. The domain core stays framework-agnostic, which matters given the planned baseSearch split and provider diversification.

**Consequences:**
- Every external dependency (SearXNG, LLM providers, DB, WebSocket) needs a port interface.
- Existing modules must be decomposed into domain + adaptor pairs.
- Slightly more files, but each file has a single responsibility.
- Future provider additions become plug-in operations.

---

## 2026-04-23 — Constructor Injection over Singleton Import

**Context:** Current code uses module-level singleton imports (e.g., importing a configured SearXNG client directly). This makes unit tests either hit real services or require complex module mocking.

**Options Considered:**
1. **Singleton import with jest.mock** — status quo. Module-level instances, tests mock the module. Fragile, couples tests to implementation.
2. **Constructor injection** — dependencies passed via constructor/function parameters. Consumers receive collaborators; tests pass fakes.
3. **Service locator** — global registry that resolves dependencies. Flexible but hides the dependency graph and makes lifecycle management implicit.

**Decision:** Constructor injection.

**Rationale:** Constructor injection makes the dependency graph explicit at the call site. Tests supply fakes without touching module internals. No global mutable state. Aligns with hexagonal architecture where adaptors are passed through ports.

**Consequences:**
- All orchestrators and handlers need constructor parameters for their collaborators.
- A composition root (likely in the API route handlers or a dedicated bootstrap) wires real implementations.
- Test setup becomes straightforward: instantiate with fakes.
- Existing singleton imports must be replaced incrementally during refactor.

---

## 2026-04-23 — Vitest over Jest

**Context:** The project needs a test framework for the new test infrastructure. Codebase is TypeScript with ESM imports, running on Next.js 16.

**Options Considered:**
1. **Jest** — industry standard, huge ecosystem. Requires `ts-jest` or `@swc/jest` for TypeScript, Babel transform for ESM. Configuration is complex for ESM projects.
2. **Vitest** — Vite-native test runner. Native TypeScript and ESM support out of the box. Shared config with Vite if present. Faster cold start and watch mode.
3. **Node:test** — built-in Node.js test runner. Zero dependencies but minimal assertion library, no built-in mocking, smaller ecosystem.

**Decision:** Vitest.

**Rationale:** Native ESM + TypeScript support eliminates the configuration friction that plagues Jest in ESM projects. Vitest is significantly faster in watch mode, which tightens the TDD feedback loop. Jest-compatible assertion API minimizes learning curve. Aligns with the Vite ecosystem direction.

**Consequences:**
- Test files use `vitest` imports (`vi`, `describe`, `it`, `expect`).
- Mocking uses `vi.fn()` and `vi.mock()` — familiar API for Jest users.
- Coverage via `@vitest/coverage-v8` (Istanbul-based).
- No `ts-jest`, no Babel transform, no `moduleNameMapper` for ESM.


---

## 2026-04-23 — Feature Branches per Epic

**Context:** The refactoring spans 8 epics. We need a branching strategy that keeps master stable while allowing parallel or sequential work on epics.

**Options Considered:**
1. **Direct commits to master** — simplest but risky; broken WIP blocks other work.
2. **Feature branch per epic (`refactor/epic-N-description`)** — each epic gets its own branch, merged via PR after review and test gate.
3. **Monorepo-style per-epic directories** — overkill for this project size.

**Decision:** Feature branch per epic.

**Rationale:** Small reviewable PRs. Master stays stable and deployable at all times. Each branch has its own test gate. If an epic needs to be paused or rolled back, only that branch is affected.

**Consequences:**
- Branch naming convention: `refactor/epic-1-test-infrastructure`, `refactor/epic-2-search-orchestration`, etc.
- Each branch must pass all prior tests before merge.
- Master is never more than one merge behind.

---

## 2026-04-23 — sqlite-vec as Post-MVP, VectorStore Port from Day 1

**Context:** The current embedding storage uses JSON files on disk (`data/uploads/*.content.json`) with brute-force JS similarity search. Two SQLite vector extensions exist: `sqlite-vec` (asg017, virtual tables, KNN) and `sqlite-vector` (sqliteai, BLOB storage, quantization). Both work with `better-sqlite3` which the project already uses.

**Options Considered:**
1. **Adopt sqlite-vec in MVP** — adds vector search capability now but increases scope and introduces a native C extension build dependency.
2. **Defer sqlite-vec to post-MVP, but define VectorStore port from day 1** — current JSON-file implementation becomes the first adapter; sqlite-vec becomes a future adapter. Architecture is ready, scope is managed.
3. **Keep current JSON-file approach without abstraction** — simplest but misses the port+adapter pattern that the rest of the architecture follows.

**Decision:** Option 2 — sqlite-vec as post-MVP, VectorStore port+adapter from day 1.

**Rationale:** Deferring sqlite-vec keeps MVP scope tight. But defining the `VectorStore` port interface now means the upload pipeline (Epic 6) and search orchestration (Epic 2) already use the abstraction. When sqlite-vec arrives, it's a new adapter class — zero changes to domain or application layers.

**Consequences:**
- A `VectorStore` port interface is defined alongside other ports in Phase 2 (search orchestration boundaries).
- `JsonFileVectorStore` adapter wraps the current JSON-file + brute-force similarity logic.
- Epic 6 upload stories reference `VectorStore` port instead of direct filesystem access.
- Post-MVP: `SqliteVecVectorStore` adapter replaces `JsonFileVectorStore` by implementing the same port.
- No additional production dependency in MVP.
