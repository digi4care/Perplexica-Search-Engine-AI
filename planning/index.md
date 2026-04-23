# Perplexica-Search-Engine-AI Refactoring — Planning Index

> Generated: 2026-04-23
> Status: Draft
> Repository: digi4care/Perplexica-Search-Engine-AI
> Base commit: 7dc5d08 (master)

## Document Map

| # | Document | Status | Last Updated |
|---|----------|--------|-------------|
| 01 | [Personas](01-persona.md) | Draft | 2026-04-23 |
| 02 | [Problem Statement](02-problem.md) | Draft | 2026-04-23 |
| 03 | [Product Vision & Value](03-vision.md) | Draft | 2026-04-23 |
| 04 | [Architecture](04-architecture.md) | Draft | 2026-04-23 |
| 05 | [User Stories](05-user-stories.md) | Draft | 2026-04-23 |
| 06 | [Requirements (FR + NFR)](06-requirements.md) | Draft | 2026-04-23 |
| 07 | [MVP Scope](07-mvp-scope.md) | Draft | 2026-04-23 |
| 08 | [MVP Plan](08-mvp-plan.md) | Draft | 2026-04-23 |
| 09 | [Testing Strategy](09-testing.md) | Draft | 2026-04-23 |
| 10 | [Release Strategy](10-release.md) | Draft | 2026-04-23 |
| 11 | [Design Log & Risks](11-design-log.md) | Draft | 2026-04-23 |
| 12 | [Diagram-Driven Design](12-diagram-driven-design.md) | Draft | 2026-04-23 |

## Progress

- [x] Personas defined
- [x] Problem validated
- [x] Vision & value prop clear
- [x] Architecture sketched
- [x] User stories written
- [x] Requirements (FR + NFR) documented
- [x] Diagram-driven design complete (all 5 layers)
- [x] MVP scope agreed
- [x] Testing strategy defined
- [x] Release strategy defined
- [x] Design log started

## Summary

**Project:** Refactor Perplexica-Search-Engine-AI (Vane fork) to SOLID, clean architecture with full test coverage.

**MVP (4 phases, ~10 days):**
1. Test foundation (Vitest + fixtures)
2. Search orchestration boundaries (ports, DI, domain services)
3. API route thinning + provider fix
4. Verification & documentation

**Post-MVP:**
- Frontend state decomposition
- baseSearch split
- Upload pipeline cleanup
- ConfigManager split

**8 epics, 38 user stories, 15 functional requirements, 6 NFR categories.**

## Resolved Questions

- [x] Confirm Vitest as test framework (vs Jest) → **Vitest** — native ESM + TS, fast, jest-compatible API
- [x] Confirm hexagonal architecture approach → **Hexagonal (ports & adapters)** for backend, pragmatic for frontend
- [x] Decide: refactor on master or feature branch per epic → **Feature branches** (`refactor/epic-N-description`)
- [x] Confirm MVP priority ordering → **Test → Search → API → Provider**

## Post-MVP Decisions

- [ ] sqlite-vec integration — deferred to post-MVP; VectorStore port+adapter from day 1 in MVP