# MVP Scope

## MVP Definition

The MVP is a **structural refactoring** of the backend architecture that establishes clean boundaries around the most critical subsystems—search orchestration, API routes, and the provider/model layer—while preserving all existing functionality. No new features are delivered. The MVP's value is a codebase where the highest-risk, highest-coupling areas are under test, have clear interfaces, and no longer contain known bugs.

## In Scope (MVP)

| # | Feature | User Stories | Priority |
|---|---------|-------------|----------|
| 1 | Test infrastructure setup | As a developer, I need a working test runner (Vitest), fixtures, and helpers so I can write and run unit/integration tests. | P0 |
| 2 | Search orchestration boundaries | As a developer, I need SearchAgent, Researcher, and Actions extracted behind clear interfaces so the search pipeline is testable in isolation. | P0 |
| 3 | API route thinning (chat + search) | As a developer, I need chat and search route handlers to delegate to application-layer services so routes contain no business logic. | P0 |
| 4 | Provider layer fix and caching | As a user, search results should not fail silently due to the provider-update bug. As a developer, ModelRegistry should cache instances across requests. | P1 |
| 5 | Type normalization (search + provider surfaces) | As a developer, I need typed contracts for search requests/results and provider interfaces so refactored modules compile and communicate safely. | P1 |
| 6 | Regression verification | As a stakeholder, I need confirmation that all existing features (search, chat, suggestions, uploads) still work after refactoring. | P0 |

## Out of Scope (Post-MVP)

| Feature | Reason | Revisit When |
|---------|--------|-------------|
| Frontend state decomposition (useChat.tsx) | Large surface area (~848 lines), lower risk since frontend is UI-only, no data corruption concerns. | Search backend is stable and tested. |
| baseSearch mega-function splitting | Depends on search orchestration boundaries being established first; extracting it prematurely creates coupling. | Search orchestration boundaries land (MVP item 2). |
| Upload pipeline refactor | Independent subsystem with no coupling to search/chat; lower user impact. | Core pipeline is stable; upload-related bugs surface. |
| ConfigManager splitting | Can be done incrementally alongside other work; not a blocking dependency. | ConfigManager coupling causes test failures or blocks new features. |
| SessionManager typed rewrite | Low risk, no known bugs; session logic is stable. | Session-related bugs surface or frontend refactor needs typed contracts. |
| New features (e.g., multi-model selection, UI redesign) | Refactoring must stabilize before adding features. | MVP success criteria pass. |
| E2E/visual regression tests | Test infrastructure MVP focuses on unit/integration coverage for refactored modules. | Unit coverage exceeds 60% on target modules. |
| CI/CD pipeline integration | Out of scope for the refactoring itself; orthogonal concern. | MVP is complete and team has bandwidth. |

## Core Assumption to Validate

**The codebase can be refactored incrementally without breaking existing functionality.**

This is the riskiest assumption because:
- The current codebase has zero tests, so there is no safety net to catch regressions.
- Search orchestration is tightly coupled (SearchAgent calls Researcher calls Actions calls baseSearch); extracting boundaries may surface hidden dependencies.
- The provider-update bug suggests state management issues that may be deeper than anticipated.
- If the assumption fails, the fallback is to establish characterization tests on the current behavior before continuing refactoring.

## MVP Success Criteria

| Metric | Target | Pass/Fail |
|--------|--------|-----------|
| All existing features functional (search, chat, suggestions, uploads) | 100% feature parity with pre-refactoring behavior | ⬜ |
| Search pipeline unit tests | ≥ 10 tests covering SearchAgent, Researcher, Actions core paths | ⬜ |
| API route handlers contain no business logic | Chat and search routes delegate to services; route bodies < 30 LOC each | ⬜ |
| Provider update bug fixed | Provider switch no longer silently fails; verified with integration test | ⬜ |
| ModelRegistry caching | Single instance per provider across requests; no re-instantiation | ⬜ |
| Test coverage on refactored modules | > 60% line coverage on search orchestration, provider layer, and application services | ⬜ |
| No `any` types on refactored interfaces | All extracted interfaces use explicit types; zero `any` in domain/application layers | ⬜ |
| TypeScript strict compilation | `tsc --noEmit` passes with no errors | ⬜ |
