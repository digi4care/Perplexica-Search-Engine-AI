# Product Vision

## Vision Statement
For developers maintaining and extending Perplexica who need a reliable, testable codebase, the refactored Perplexica is an AI search engine that delivers clean architectural boundaries and full test coverage, making every subsystem independently verifiable and replaceable. Unlike the current monolithic coupling, we provide SOLID-compliant modules with thin route handlers and injectable dependencies.

## Value Proposition
We deliver a codebase where every subsystem can be understood, tested, and changed in isolation. Developers can add a new AI provider, change the search orchestration, or refactor the frontend state without touching unrelated code. The architecture makes correct usage easy and incorrect usage impossible through typed interfaces and dependency injection. Every change is backed by tests that fail when behavior breaks, not when implementation shifts.

## Value Map

| User Pain | Our Pain Reliever | Priority |
|-----------|-------------------|----------|
| 848-line useChat hook makes any UI change a regression gamble | Decompose into focused state slices with single-responsibility hooks | H |
| Zero test coverage means every change is deployed on faith | Full unit and integration test suite covering all core paths | H |
| Search orchestration hard-coupled to DB, session, and LLM | Clean hexagonal boundaries with injectable adapters | H |
| 424-line baseSearch with 3 modes tangled in one function | Mode-strategy pattern with independent, testable search pipelines | H |
| ConfigManager singleton prevents testing and parallel config | Injectable configuration with interface-driven access | H |
| ModelRegistry re-instantiates per request with provider-update bugs | Stateful registry with proper lifecycle and typed provider interface | M |
| UploadManager mixes parsing, chunking, embedding, I/O, and records | Pipeline architecture with composable, independently testable stages | M |
| SessionManager untyped event bus and duplicated stream wiring | Typed event system with centralized stream lifecycle management | M |
| Frontend type chaos with `any`, circular imports, types in components | Strict type discipline with centralized type definitions | M |
| Route handlers contain duplicated business logic wiring | Thin routes delegating to application services | H |
| Duplicated wiring across search-related routes | Shared application service layer eliminating copy-paste orchestration | H |

| User Gain | Our Gain Creator | Priority |
|-----------|-------------------|----------|
| Ability to add providers without touching core logic | Provider adapter interface with registration mechanism | H |
| Confidence that refactors don't break existing behavior | Test suite that locks invariants while allowing implementation change | H |
| New developers onboard faster through clear module boundaries | Deep modules with well-defined interfaces and no hidden coupling | H |
| CI catches regressions before they reach main | Automated test pipeline with coverage gates | M |
| Frontend state changes don't cascade across components | Decomposed state with owned subscriptions and narrow re-render scopes | M |
| Agent-friendly API surface for AI-assisted development | Consistent patterns, typed interfaces, discoverable module structure | M |
| Search modes can be tested and benchmarked independently | Strategy pattern with per-mode test harnesses | M |
| Configuration can be validated and tested in isolation | Injectable config with schema validation and test doubles | L |

## Alternatives

| Alternative | Strength | Weakness |
|-------------|----------|----------|
| Rewrite from scratch | Clean slate, no legacy constraints, can pick ideal architecture upfront | Throws away working search integration, streaming UI, and 8 provider adapters. Highest risk of feature regression. Longest time to value. |
| Leave as-is and patch incrementally | No refactoring cost, ship features immediately | Technical debt compounds. God objects grow. Every change risk increases. Already at the point where simple changes require understanding 800+ line hooks. |
| Extract interfaces only (shallow refactor) | Low effort, some testability improvement | Interfaces over god objects are still god objects. Doesn't solve the coupling or testability problem, just hides it behind abstractions. |
| Full SOLID refactor with test coverage (chosen) | Maximum long-term maintainability, each subsystem independently testable and replaceable | Significant upfront effort. Requires disciplined phased execution. Short-term velocity dip. |

## Strategic Goals

1. **Testable search pipeline** — Decompose the monolithic search orchestration into mode-specific strategies with clean interfaces, enabling each mode (speed, balanced, quality) to be tested independently with injected LLM and search adapters.

2. **Thin route handlers delegating to application services** — Move all business logic out of route handlers into a service layer. Routes handle HTTP concerns only (request parsing, response formatting, error mapping). Application services own orchestration, validation, and coordination.

3. **Injectable providers with typed interfaces** — Replace singletons and per-request instantiation with a proper dependency injection container. Every external dependency (LLM providers, database, config, session management) accessed through typed interfaces that accept test doubles.

4. **Decomposed frontend state** — Break the 848-line useChat hook into focused state slices (message stream, search status, file uploads, UI state) with owned subscriptions and narrow re-render scopes. Centralize types and eliminate circular imports.

5. **Full test coverage on core paths** — Achieve meaningful test coverage on search orchestration, provider management, configuration, session lifecycle, and upload pipeline. Tests verify behavior contracts, not implementation details.

## Non-Goals

- Adding new AI providers or search backends
- Changing the UI/UX design or visual layout
- Building a mobile application
- Implementing user authentication or authorization
- Migrating away from SQLite or Drizzle ORM
- Replacing Next.js with another framework
- Adding new search modes beyond speed/balanced/quality
- Internationalization or localization
- Performance optimization of search algorithms
- Changing the SearxNG integration protocol

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Core path test coverage | ≥80% line coverage on search, providers, config, session, upload | `vitest --coverage` on src/backend |
| Zero `any` in backend code | 0 occurrences of `: any` or `as any` in TypeScript strict mode | `grep -r ': any\|as any' src/backend/` returns empty |
| Max file complexity | No file exceeds 200 lines or cyclomatic complexity 15 | `complexity-report` or lint rules on CI |
| Module count (deep modules) | ≥15 focused modules replacing current god objects | Count of files in src/backend/core and src/backend/adapters |
| Route handler LOC | Each route handler ≤50 lines, no business logic | Line count + grep for DB/LLM/session calls in route files |
| useChat decomposition | ≤150 lines per hook slice, 0 hook exceeds 1 state concern | Line count per file in decomposed hook directory |
| Type safety enforcement | `strict: true` in tsconfig with zero type errors | `tsc --noEmit` passes cleanly |
| Dependency injection coverage | 0 direct imports of singletons in core/services | `grep` for ConfigManager.getInstance or direct DB imports in service layer |
