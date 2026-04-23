# Perplexica Search Engine AI

A **privacy-focused AI answering engine** refactored with clean hexagonal architecture, full test coverage, and SOLID principles.

> **Attribution:** This project is a refactored fork of [Vane](https://github.com/ItzCrazyKns/Vane) by [ItzCrazyKns](https://github.com/ItzCrazyKns), which itself was a fork of [Perplexica](https://github.com/ItzCrazyKns/Perplexica). The original work — including the search orchestration, multi-provider support, streaming UI, and widget system — is entirely theirs. This repository takes that foundation and rebuilds it with proper architectural boundaries and testability.

## What Changed from the Original

This is not a drop-in replacement. It is a ground-up refactor of the internal architecture while preserving all user-facing features:

- **Hexagonal architecture** — domain logic isolated behind port/adapter interfaces, no infrastructure leaks into business logic
- **Full test coverage** — Vitest-based test suite with smoke, unit, integration, and e2e layers
- **Typed events** — no more `any`-typed event bus; all streaming events are compile-time checked
- **Decomposed frontend state** — the 848-line `useChat` hook split into focused, composable hooks
- **Provider layer fixed** — ModelRegistry caching, `updateProvider` bug resolved, normalized adapter pattern
- **VectorStore abstraction** — embedding storage behind a port interface, ready for sqlite-vec integration

All existing features are preserved: web/academic/social search, chat with streaming, file uploads, multi-provider AI support, widgets, and Docker deployment.

## Features

- **Multi-provider AI support** — OpenAI, Anthropic Claude, Google Gemini, Ollama, Groq, LMStudio, HuggingFace Transformers, Lemonade
- **Smart search modes** — Speed, Balanced, and Quality modes for different research needs
- **Multiple search sources** — Web, academic papers, discussions
- **Widgets** — Weather, stock prices, calculations rendered inline
- **File uploads** — Upload PDFs, DOCX, TXT and ask questions about them
- **Streaming responses** — Real-time token-by-token delivery with cited sources
- **Privacy-first** — Runs entirely on your own hardware with SearxNG
- **Search history** — All searches saved locally

## Quick Start

### Docker (Recommended)

```bash
docker run -d -p 3000:3000 \
  -v perplexica-data:/home/vane/data \
  --name perplexica \
  ghcr.io/digi4care/perplexica-search-engine-ai:latest
```

Open http://localhost:3000 and configure your settings.

### With Your Own SearxNG

```bash
docker run -d -p 3000:3000 \
  -e SEARXNG_API_URL=http://your-searxng-url:8080 \
  -v perplexica-data:/home/vane/data \
  --name perplexica \
  ghcr.io/digi4care/perplexica-search-engine-ai:slim-latest
```

Your SearxNG instance needs JSON format enabled and Wolfram Alpha search engine enabled.

### From Source

```bash
git clone https://github.com/digi4care/Perplexica-Search-Engine-AI.git
cd Perplexica-Search-Engine-AI
npm install
npm run build
npm run start
```

Open http://localhost:3000 to complete setup.

## API

### Search

```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is hexagonal architecture?",
    "sources": ["web"],
    "chatModel": { "providerId": "openai", "key": "gpt-4" },
    "embeddingModel": { "providerId": "openai", "key": "text-embedding-3-small" },
    "optimizationMode": "balanced"
  }'
```

### Chat

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "messageId": "msg-1",
      "chatId": "chat-1",
      "content": "Explain vector databases"
    },
    "optimizationMode": "quality",
    "chatModel": { "providerId": "openai", "key": "gpt-4" },
    "embeddingModel": { "providerId": "openai", "key": "text-embedding-3-small" }
  }'
```

## Architecture

The system follows a hexagonal (ports & adapters) architecture with four layers:

| Layer | Responsibility |
|-------|---------------|
| **Presentation** | Next.js routes (thin adapters) + React components with decomposed hooks |
| **Application** | Use-case services: `ChatService`, `SearchService`, `UploadService`, `ConfigService` |
| **Domain** | Pure TypeScript — search agent loop, researcher, classifier, widgets, types |
| **Infrastructure** | Adapter implementations: AI providers, SearxNG, SQLite/Drizzle, filesystem, VectorStore |

All dependencies flow inward. The domain layer has zero infrastructure imports.

See [planning/04-architecture.md](planning/04-architecture.md) for the full architecture diagram and decision log.

## Development

```bash
npm install
npm run dev          # Start development server
npm test             # Run test suite
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Generate coverage report
npm run build        # Production build
npm run lint         # Lint check
```

## Troubleshooting

### Ollama Connection Errors

- Ensure Ollama API URL is correct in settings
- Windows/Mac: use `http://host.docker.internal:11434`
- Linux: use `http://<private_ip_of_host>:11434` and expose with `OLLAMA_HOST=0.0.0.0:11434`

### Local OpenAI-API Servers

- Bind to `0.0.0.0` (not `127.0.0.1`)
- Specify the correct model name
- Put a value in the API key field even if none is required

## License

MIT — same as the [original project](https://github.com/ItzCrazyKns/Vane/blob/master/LICENSE).
