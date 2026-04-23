# Personas

## Primary Persona: The Maintainer/Developer

- **Role:** Solo engineer forking and refactoring an AI search engine codebase
- **Demographics:** 25–45, senior/staff-level TypeScript developer, comfortable with system design and architecture patterns. Working on a personal/professional fork of an open-source project (originally Vane by ItzCrazyKns), now maintained as digi4care/Perplexica-Search-Engine-AI.
- **Goals:** Refactor a working but architecturally degraded codebase into a clean, maintainable system with SOLID boundaries, proper dependency injection, typed events, decomposed frontend state, and full test coverage. Ship a codebase that a future contributor (or the maintainer six months from now) can understand and extend without tracing through 848-line hooks or 424-line mega-functions.
- **Pain points:** God objects and god hooks that make every change a cross-cutting concern. Zero tests mean every refactor is a leap of faith. Hard-coupled orchestrators (SearchAgent, Researcher, ConfigManager) resist modification. Frontend state chaos (13 useState in one hook, untyped event bus) makes UI changes unpredictable. Routes contain duplicated business logic, so adding a feature means touching multiple handler files.
- **Behaviors:** Currently navigates the codebase by grep-and-read, tracing call chains through tangled imports. Works around architectural problems by adding conditional branches rather than decomposing modules. Skips writing tests because the code isn't structured for injection or mocking. Refers to the original repo for context when the fork diverges.

## Secondary Persona: The Self-Hosting User

- **Role:** Individual or small-team operator deploying the search engine on private infrastructure
- **Demographics:** 20–50, technical but not necessarily a developer — may be a sysadmin, DevOps engineer, or power user. Comfortable with Docker, environment variables, and YAML/JSON config. Deploys via docker-compose or similar.
- **Goals:** Run a private, self-hosted AI search engine with their choice of LLM provider (OpenAI, Ollama, Gemini, Anthropic, Groq, LMStudio, or local Transformers/Lemonade). Configure and swap providers at runtime without restarting. Upload documents for RAG-augmented search. Get fast, relevant search results through a clean web UI or API.
- **Pain points:** Configuration is brittle — the JSON config file and runtime provider management have bugs (e.g., ModelRegistry updateProvider issues). Adding or switching providers requires understanding internals. Error messages are opaque when a provider misbehaves. File upload pipeline is unreliable because concerns are mixed (parsing, chunking, embedding, I/O all coupled). No health checks or diagnostic endpoints.
- **Behaviors:** Deploys via Docker, edits config.json or uses the settings UI to configure providers. Uses SearxNG as the search backend, often running it alongside. May script against the POST /api/search endpoint for automation. Troubleshoots by reading logs and restarting containers.

## Secondary Persona: The API Consumer / Coding Agent

- **Role:** Programmatic client — either a developer integrating search into their own application, or an AI coding agent making autonomous search queries
- **Demographics:** Not human in the traditional sense — this is a machine client. The developer behind it expects stable, predictable, well-typed HTTP APIs with clear request/response schemas. The coding agent expects consistent JSON shapes, meaningful error codes, and idempotent behavior.
- **Goals:** Send search queries via POST /api/search with configurable modes (speed, balanced, quality), optional file attachments, and streaming responses. Get structured, predictable JSON back — or a clean SSE stream for progressive results. Integrate search results into downstream workflows, RAG pipelines, or agent loops.
- **Pain points:** API surface is entangled with internal orchestration — routes contain business logic, so behavior can vary in unexpected ways. No OpenAPI spec or typed contract. Error responses are inconsistent (sometimes HTML error pages, sometimes JSON, sometimes truncated streams). Session management is opaque — stream lifecycle and session cleanup are not documented or predictable.
- **Behaviors:** Sends HTTP requests with JSON bodies, consumes SSE streams, retries on failures. May poll or long-poll for results. Expects standard HTTP semantics (proper status codes, idempotency, rate limit headers). Scripts against the API rather than using the UI.
