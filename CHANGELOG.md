# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-04-24

### Summary

Major architectural refactoring of the Vane search engine. Hexagonal architecture
with ports, adapters, services, and a composition root. Full test coverage across
all application layers. Zero ESLint warnings. Docker migrated from yarn to npm.

**281 tests across 23 test files. 0 ESLint problems.**

### Added

- **Hexagonal architecture**: Port interfaces in `src/lib/ports/` (ChatModel, EmbeddingModel, MessageStore, SearchBackend, VectorStore, SessionEmitter)
- **Adapter layer**: DrizzleMessageStore, SearxngSearchBackend, SqliteVecVectorStore in `src/lib/adapters/`
- **Service layer**: ChatService, SearchService in `src/lib/services/`
- **Composition root**: `src/lib/composition.ts` — single point for adapter instantiation and dependency injection
- **sqlite-vec VectorStore adapter**: `vec0` virtual table with BigInt rowid pattern for vector similarity search
- **SSE streaming helper**: `src/lib/http/sessionStream.ts` — reusable event emitter for chat/reconnect routes
- **Vitest test infrastructure**: 281 tests across 23 files with v8 coverage provider
- **ESLint 9 flat config**: Migrated from `.eslintrc.json` to `eslint.config.mjs`
- **Docker Hub CI/CD**: Automated build + push on master push and version tags (`docker.yml`)
- **CHANGELOG.md**: This file

### Changed

- **baseSearch decomposition** (421 → 49 lines): Strategy dispatcher delegates to `speedSearch.ts` and `qualitySearch.ts` via `searchHelpers.ts`
- **useChat decomposition** (847 → 192 lines): Orchestrator composes `useChatConfig`, `useChatHistory`, `useChatStream`, `useSectionParser`
- **ConfigManager split** (391 → 68 lines facade): Delegates to `configReader.ts`, `configWriter.ts`, `configMigration.ts`, `configDefaults.ts`
- **SearchAgent + APISearchAgent**: Constructor injection via composition root (no global singletons)
- **Researcher + baseSearch**: Decoupled from direct DB/SearXNG dependencies
- **ModelRegistry**: Cached singleton via composition root. Fixed `updateProvider` bug (push → replace)
- **API routes**: Thinned — business logic extracted to services, routes handle HTTP only
- **SessionManager**: Global singleton map removed, sessions managed through composition root
- **Provider adapters**: Deduplicated — removed 3 empty subclass files
- **Dockerfile**: Migrated from yarn to npm (`npm ci --legacy-peer-deps`)
- **README**: Rewritten with original author attribution + refactoring philosophy

### Fixed

- 21 ESLint warnings/errors → 0 problems
  - 5 `set-state-in-effect` errors (SSR hydration patterns)
  - 8 `no-img-element` warnings (`<img>` → Next.js `<Image />`)
  - 6 `exhaustive-deps` warnings (added missing deps)
  - 2 `no-html-link-for-pages` warnings (`<a>` → `<Link />`)
- ModelRegistry.updateProvider bug: `push` replaced with index-based replace
- ESM import for sqlite-vec: must use named `import { load }` not default import

### Test Coverage

| Layer | Files | Tests | Coverage |
|-------|-------|-------|----------|
| Smoke/Type/Schema | 6 | 34 | Foundation |
| Search Agents | 4 | 40 | Strategy patterns |
| HTTP Streaming | 1 | 8 | SSE helper |
| Services | 2 | 24 | ChatService + SearchService |
| Config | 1 | 38 | Reader/Writer/Migration |
| Adapters | 1 | 7 | sqlite-vec VectorStore |
| API Routes | 2 | 15 | Integration tests |
| React Hooks | 4 | 94 | useChat decomposition |
| Composition | 1 | 11 | Root + ModelRegistry |
| **Total** | **23** | **281** | |

### Migration Guide (from v1.x)

**Docker**: Pull `digi4care/perplexica-search-engine-ai:2.0.0`. **Breaking**: Volume mount path changed from `/home/vane/data` to `/home/digi4care/data`. Update your docker-compose or docker run commands accordingly.

**Development**: Run `npm install --legacy-peer-deps` instead of `yarn install`.

**Architecture**: If you imported from internal paths, note the new structure:
- `src/lib/ports/` — interfaces
- `src/lib/adapters/` — implementations
- `src/lib/services/` — application logic
- `src/lib/composition.ts` — dependency injection

## [1.12.2] - 2025-04-15

Last upstream release by [ItzCrazyKns](https://github.com/ItzCrazyKns).

See [upstream releases](https://github.com/ItzCrazyKns/Vane/releases) for historical changelog.

[2.0.0]: https://github.com/digi4care/Perplexica-Search-Engine-AI/releases/tag/v2.0.0
[1.12.2]: https://github.com/ItzCrazyKns/Vane/releases/tag/v1.12.2
