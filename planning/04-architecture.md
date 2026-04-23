# Architecture

## System Overview

Perplexica (vane) is a self-hosted AI search engine that accepts natural-language queries, orchestrates multi-step research across web and uploaded-document sources, and streams structured responses to a progressive chat UI. Post-refactor, the system follows a hexagonal (ports & adapters) architecture with four layers:

1. **Presentation** -- Next.js App Router routes and React components. Routes are thin adapters that deserialize requests, call an application service, and serialize responses. React components consume decomposed state hooks rather than a single god-hook.
2. **Application** -- Use-case services (`ChatService`, `SearchService`, `UploadService`, `ConfigService`) that orchestrate domain logic, manage transactions, and coordinate infrastructure adapters. Dependencies are injected via constructor parameters.
3. **Domain** -- Pure TypeScript with zero infrastructure imports. Contains the search-agent loop, researcher action registry, classifier, widget executor, prompt construction, and all domain types (`Message`, `Block`, `Tool`, `ToolCall`). Domain logic is testable in isolation with no database, filesystem, or network access.
4. **Infrastructure** -- Adapter implementations of domain-defined ports: AI provider adapters (OpenAI, Ollama, Gemini, Anthropic, Groq, LMStudio, Transformers, Lemonade), SearxNG search backend, SQLite via Drizzle ORM, filesystem upload storage, JSON config persistence, and the embedding pipeline.

The frontend decomposes the current monolithic `useChat` hook into focused hooks (`useMessages`, `useStreaming`, `useSections`, `useResearchProgress`, `useFileUpload`, `useSettings`), each managing a single concern and composed at the component level.

## Architecture Diagram

```mermaid
graph TB
    subgraph Presentation
        R[App Router Routes<br/>thin adapters]
        C[React Components<br/>Chat, ChatWindow, MessageBox...]
        FH[Decomposed Hooks<br/>useMessages, useStreaming,<br/>useSections, useResearch...]
    end

    subgraph Application
        CS[ChatService]
        SS[SearchService]
        US[UploadService]
        CF[ConfigService]
    end

    subgraph Domain
        SA[Search Agent<br/>loop + tool calling]
        RS[Researcher<br/>action registry]
        CL[Classifier]
        WE[Widget Executor]
        DT[Domain Types<br/>Message, Block, Tool, ToolCall]
        PC[Prompt Construction]
    end

    subgraph Infrastructure
        PA[Provider Adapters<br/>OpenAI · Ollama · Gemini<br/>Anthropic · Groq · LMStudio<br/>Transformers · Lemonade]
        SX[SearxNG Adapter]
        DB[SQLite · Drizzle ORM]
        FS[Filesystem Upload Store]
        JP[JSON Config Store]
        EP[Embedding Pipeline]
        VS[VectorStore Adapter<br/>JsonFile · (sqlite-vec post-MVP)]
    end

    external[External Systems]
    subgraph External Systems
        SXNG[SearxNG Instance]
        LLM[AI Provider APIs<br/>OpenAI · Ollama · Gemini · etc.]
    end

    C --> FH
    FH --> R
    R --> CS
    R --> SS
    R --> US
    R --> CF

    CS --> SA
    CS --> DB
    SS --> SA
    SS --> SX
    US --> EP
    US --> FS
    US --> DB
    US --> VS

    SA --> RS
    SA --> CL
    SA --> DT
    RS --> PA
    RS --> PC
    RS --> WE
    CF --> JP

    SX --> SXNG
    PA --> LLM
    EP --> PA
```

## Key Technical Decisions

| Decision | Choice | Rationale | Trade-off |
|----------|--------|-----------|-----------|
| Backend architecture | Hexagonal (ports & adapters) | Decouples business logic from infrastructure; enables unit testing of domain without mocks of external services | More files and indirection layers vs. current flat structure; team must understand port/adapter boundaries |
| Dependency injection | Constructor parameters (manual DI) | Explicit dependencies, no hidden globals, testable with fakes; avoids framework lock-in from DI containers | Wiring boilerplate in composition root; no auto-resolution |
| Singleton removal | Remove `ConfigManager` and `SessionManager` singletons | Singletons hide coupling, prevent parallel test execution, and make dependency graphs opaque | Must pass dependencies explicitly through call chains |
| Event system | Typed event emitter replacing untyped `SessionManager` bus | Compile-time guarantees that events are handled correctly; self-documenting event contracts | Slightly more verbose event type definitions |
| Frontend state | Decomposed hooks from god `useChat` hook | Each hook owns one concern (messages, streaming, sections, research, uploads, settings); independently testable and replaceable | More hooks to compose; requires discipline to avoid re-accumulating state in a single hook |
| Test framework | Vitest | Native ESM/TypeScript support, fast, compatible with existing Next.js toolchain; shares config with Vite-based tooling | Community is smaller than Jest; some Jest-specific libraries need adapter setup |
| Search modes | Strategy pattern per mode (speed/balanced/quality) instead of branching in a single function | Each mode is a standalone class satisfying a `SearchMode` port; new modes added without touching existing ones | More classes to maintain; shared logic must be extracted into shared helpers rather than inlined |
| Config persistence | JSON file via adapter port, not direct `fs` in domain | Domain defines a `ConfigStore` port; infrastructure implements filesystem JSON; enables in-memory config for tests | Extra abstraction layer for what is currently a single file read |
| Streaming protocol | Server-Sent Events with typed block envelopes | Maintains current progressive UX; typed envelopes let frontend parse without guesswork | SSE is unidirectional; WebSocket would allow richer duplex but adds complexity with no current need |
| Database access | Repository pattern over Drizzle queries | Domain defines repository ports (`MessageRepository`, `ChatRepository`); infrastructure implements with Drizzle; Swappable for testing | Extra repository interface layer over already-abstract Drizzle ORM |
| VectorStore abstraction | Port interface from day 1, sqlite-vec as post-MVP adapter | Current JSON-file embedding storage wrapped behind VectorStore port; enables future sqlite-vec swap without domain changes | Extra interface for what is currently a single implementation; justified by planned sqlite-vec migration |

## Technology Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React 18 with TypeScript strict mode | Existing codebase; mature ecosystem; component model fits chat UI well |
| Frontend Styling | Tailwind CSS 3 | Already in use; utility-first approach keeps styling colocated and avoids dead CSS |
| Frontend State | Decomposed React hooks + Context | No additional state library needed; hooks provide testability and locality |
| Backend Framework | Next.js 16 App Router | Existing codebase; server actions and route handlers serve as presentation adapters |
| Language | TypeScript 5.9 strict | Existing codebase; strict mode catches null/undefined errors at compile time |
| Database | SQLite via better-sqlite3 | Self-hosted, zero-config, file-based; fits single-server deployment model |
| ORM | Drizzle ORM | Type-safe query builder; lightweight; already in use |
| Validation | Zod 4 | Runtime schema validation for API boundaries and config; already a dependency |
| Test Runner | Vitest | Fast, ESM-native, TypeScript-first; minimal config overhead |
| Search Backend | SearxNG (external) | Meta-search engine; privacy-preserving; already integrated |
| AI Providers | OpenAI SDK + provider-specific clients | Provider adapters normalize 8 AI backends behind a common `LLMProvider` port |
| File Parsing | mammoth (DOCX), pdf-parse (PDF), officeparser (PPT/XLS) | Already in use; handles uploaded document formats |
| Embeddings | Provider-specific embedding adapters | Normalized behind `EmbeddingProvider` port; supports OpenAI, Ollama, Transformers, Lemonade |
| PDF Export | jsPDF | Already in use for chat export feature |

## Integration Points

### SearxNG (Meta-Search Engine)
- **Direction**: Outbound HTTP
- **Purpose**: Web, academic, social, and image search queries
- **Contract**: REST API with JSON response format; instance URL configured via application config
- **Failure mode**: If SearxNG is unreachable, search actions fail gracefully; the agent loop reports the failure as a research step and continues with available sources

### AI Provider APIs (8 providers)
- **Direction**: Outbound HTTP/SSE
- **Purpose**: Chat completions (text generation + tool calling), embeddings, and structured object generation
- **Providers**: OpenAI, Ollama, Gemini (Google GenAI SDK), Anthropic, Groq, LMStudio, HuggingFace Transformers (local), Lemonade
- **Contract**: Each provider implements the `LLMProvider` port (`generateText`, `streamText`, `generateObject`, `streamObject`) and the `EmbeddingProvider` port (`embed`, `embedBatch`)
- **Failure mode**: Provider-specific error codes are normalized into domain error types; the agent loop retries with backoff or falls back to an alternate provider if configured

### Filesystem (Upload Storage)
- **Direction**: Local I/O
- **Purpose**: Storing uploaded files, parsed text chunks, and embedding vectors for RAG
- **Contract**: `UploadStore` port abstracts file read/write; default implementation uses a configurable local directory
- **Failure mode**: Disk-full or permission errors surface as application-level errors with user-visible messages

### VectorStore (Embedding Search)
- **Direction**: Internal (port/adapter)
- **Purpose**: Store and query embedding vectors for similarity search (RAG)
- **Contract**: `VectorStore` port with `upsert(docId, embeddings)`, `query(embedding, topK)`, `delete(docId)` methods
- **Current adapter**: `JsonFileVectorStore` — JSON files on disk with brute-force JS similarity
- **Post-MVP adapter**: `SqliteVecVectorStore` — native KNN via sqlite-vec virtual tables
- **Failure mode**: Query failures surface as empty results with a warning; upload pipeline continues without similarity search

### Configuration Store
- **Direction**: Local I/O
- **Purpose**: JSON-based application config (provider credentials, preferences, search settings)
- **Contract**: `ConfigStore` port with `load`/`save` operations; default implementation reads/writes a JSON file
- **Failure mode**: Corrupt config triggers a reset-to-defaults with a warning; missing config triggers first-run setup flow

### Weather and Stock APIs
- **Direction**: Outbound HTTP
- **Purpose**: Widget data for weather (SearxNG weather endpoint) and stock quotes (yahoo-finance2)
- **Contract**: Widget executor calls these through adapter ports, not directly from domain logic
- **Failure mode**: Widget renders a graceful fallback message when data is unavailable
