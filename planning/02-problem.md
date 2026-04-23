# Problem Statement

## Current Situation

Perplexica-Search-Engine-AI is a Next.js 16 TypeScript AI search engine with 8 LLM providers, SearxNG integration, file-upload RAG, and a progressive streaming chat UI. It works end-to-end for the happy path. Underneath, it carries ten structural defects that make every change expensive and risky:

1. **God hook: `useChat.tsx` (847 lines, 16 `useState`, 28 context values).** A single React hook owns chat ID management, message streaming, file upload coordination, provider selection, config readiness, error state, suggestion loading, and block patching. Any UI change — adding a toolbar button, changing how suggestions appear, or fixing a loading state — requires editing the same 847-line function and reasoning about 16 independently mutable state variables.

2. **God orchestrator: `SearchAgent` + `Researcher` hard-coupled to DB, Session, and LLM.** The search pipeline directly instantiates database connections, session managers, and model providers. There is no seam between orchestration logic and infrastructure. Changing the session storage backend or swapping the streaming transport requires editing the agent core.

3. **Mega-function: `baseSearch.ts` (423 lines, 3 modes in 1 function).** Speed, balanced, and quality search modes are interleaved inside a single `executeSearch` function via branching conditionals. Each mode has distinct chunking, embedding, and ranking logic — all sharing the same scope and control flow. Adding a fourth mode or modifying one mode's ranking without breaking the others requires tracing every branch.

4. **God object: `ConfigManager` (390 lines, singleton, no injection).** A module-level singleton wraps JSON file I/O, provider CRUD, model validation, and config schema management. Every module that needs configuration imports it directly: `import configManager from '../config'`. There is no way to supply a test config, a per-request config, or a config from a different source without editing the singleton.

5. **Routes ARE orchestration.** All 9 API route handlers (`chat`, `config`, `images`, `providers`, `search`, `suggestions`, `uploads`, `videos`) construct their own `ModelRegistry`, read config, validate input, orchestrate business logic, and write responses. The same wiring (instantiate registry → load model → run logic → stream response) is copy-pasted across every handler. Business decisions live in Next.js route files, not in testable service functions.

6. **`ModelRegistry` re-instantiated per request, carries an `updateProvider` bug.** Every API route creates `new ModelRegistry()`, which re-reads config and re-initializes all providers on each request. The `updateProvider` method on line 189 does `this.activeProviders.push(...)` instead of replacing the existing entry, causing duplicate providers to accumulate within a single request's lifecycle.

7. **`UploadManager` mixes 5 concerns.** File parsing (PDF, DOCX, TXT), text chunking, embedding generation, disk I/O, and database record management all live in one module. Changing the chunking strategy requires understanding how it interacts with embedding batch sizes and upload directory paths.

8. **`SessionManager`: untyped event bus, duplicated session-to-stream wiring.** Sessions use stringly-typed event names with no compile-time checking. The wiring between a session's state and the HTTP streaming response is duplicated across route handlers rather than encapsulated once.

9. **Frontend type chaos.** TypeScript types are defined inside component files rather than in shared type modules. Circular imports exist between `ChatWindow` components. Several props and state values are typed as `any`. The context shape (28 values) has no declared interface — it is built inline in the JSX.

10. **Zero tests.** There are no test files in the entire repository — no unit tests, no integration tests, no e2e tests. No subsystem can be verified in isolation. Any change is a leap of faith.

## Root Cause

The codebase grew from a solo-developer prototype where speed of iteration was the only priority. Each new feature — a new search mode, a new provider, file uploads — was added by extending the closest existing module rather than introducing a new abstraction. This produced a monolithic architecture with these structural properties:

- **No dependency injection.** Singletons are imported directly (`configManager`, `new ModelRegistry()`). There are no constructor-injected dependencies, no factory functions, no interfaces that could be swapped for test doubles.
- **No layered architecture.** There is no separation between route handling, application logic, and infrastructure. Route handlers are the application layer, and they reach directly into config singletons, database clients, and model providers.
- **No test seams.** Because every module hard-imports its collaborators, there is no way to substitute a mock database, a mock LLM, or a mock search engine without editing the production code.
- **Accidental complexity in control flow.** The three search modes grew organically inside one function. The chat hook accumulated state variables one feature at a time. Neither was ever decomposed because there was no external pressure (no tests, no team communication) forcing modularity.

The underlying unmet need is an **architecture that supports change**: the ability to add a provider, modify a search mode, or fix a bug in one subsystem without reasoning about the entire codebase.

## Impact

- **Every change requires reasoning about the whole system.** Editing `useChat.tsx` to fix a loading state bug requires understanding how 16 state variables interact with streaming, config readiness, file uploads, and provider selection. A developer touching this file cannot predict the side effects of their change.
- **No subsystem can be tested in isolation.** The 0-test count is not a discipline gap — it is a structural impossibility. You cannot instantiate a `SearchAgent` without a real database, a real config file, and a real LLM connection. You cannot test `baseSearch` without a running SearxNG instance and embedding model. You cannot test the chat hook without mounting the entire application.
- **Bugs ship silently and persist.** The `updateProvider` push-instead-of-replace bug in `ModelRegistry` (line 189) has gone undetected because no test exercises provider updates, and the symptom (duplicate providers in a single request) only manifests under specific admin workflows. Similar latent bugs almost certainly exist in the other god objects.
- **Feature velocity degrades with each addition.** Each new feature increases the surface area of the god modules, making the next feature harder. Adding a 9th provider required editing `ConfigManager`, `ModelRegistry`, the provider type map, and every route that constructs a registry. Adding a 4th search mode would require adding a third branch inside the already-423-line `baseSearch` function.
- **Onboarding is slow.** A new contributor must read 847-line hooks, 423-line search functions, and 390-line config singletons to understand how any single feature works. There are no module boundaries to provide orientation.
- **Refactoring is high-risk.** Because there are no tests, any restructuring — even extracting a function — can only be verified by running the full application and exercising the affected path manually. The risk of introducing regressions is unacceptably high, which creates a vicious cycle: the code is hard to change → changes are avoided → the code gets worse → it gets even harder to change.

## Evidence

All findings are grounded in direct source code inspection:

| Claim | Source | Metric |
|---|---|---|
| God hook | `src/lib/hooks/useChat.tsx` | 847 lines, 16 `useState` calls, 28 context values (lines 810–837) |
| Mega-function | `src/lib/agents/search/researcher/actions/search/baseSearch.ts` | 423 lines, `executeSearch` starts line 12, mode branch at line 37 |
| God config | `src/lib/config/index.ts` | 390 lines, `class ConfigManager` at line 7, module-level singleton export |
| ModelRegistry bug | `src/lib/models/registry.ts` line 189 | `this.activeProviders.push(...)` in `updateProvider` instead of replace |
| Per-request instantiation | `src/app/api/chat/route.ts` line 128, and 8 other route files | `const registry = new ModelRegistry()` in every handler |
| Zero tests | `src/` tree | No `.test.*` or `.spec.*` files found anywhere in the source tree |
| Route-as-orchestration | All 9 `src/app/api/*/route.ts` files | Business logic (model loading, search orchestration, streaming) in route handlers |
| 8 providers | `src/lib/models/providers/` directory | OpenAI, Ollama, Gemini, Anthropic, Groq, LMStudio, Transformers, Lemonade |
