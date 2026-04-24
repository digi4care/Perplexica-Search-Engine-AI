# Vercel AI SDK Migration Plan

## Executive Summary

Replace 8 custom model provider implementations with the Vercel AI SDK, while preserving the hexagonal port/adapter architecture. The SDK provides unified `generateText`, `streamText`, and `embed` APIs across all providers.

**Scope:** ~30 files, ~1500 lines of custom provider code replaced by SDK calls.
**Risk:** Medium — streaming/SSE contract changes, Ollama community provider, Transformers.js has no SDK provider.
**Timeline estimate:** 4-6 phased PRs.

---

## Current State

### Provider Architecture
```
src/lib/models/
  ModelRegistry.ts          — registry with reload(), getActiveProviders()
  types.ts                  — MinimalProvider, Model interfaces
  providers/
    openai/                 — openaiLLM.ts (chat), openaiEmbedding.ts — 20 hardcoded models
    anthropic/              — anthropicLLM.ts
    gemini/                 — geminiLLM.ts, geminiEmbedding.ts
    groq/                   — groqLLM.ts (uses OpenAI-compatible SDK internally)
    ollama/                 — ollamaLLM.ts, ollamaEmbedding.ts
    lmstudio/               — lmstudioLLM.ts (OpenAI-compatible)
    lemonade/               — lemonadeLLM.ts, lemonadeEmbedding.ts (OpenAI-compatible)
    transformers/           — transformersEmbedding.ts — 3 hardcoded models, runs in-process
```

### Port Interfaces
```typescript
// src/lib/ports/ChatModel (conceptual — used via ModelRegistry)
interface ChatModel {
  generate(prompt: string, options?: any): Promise<string>;
  stream(prompt: string, options?: any): AsyncIterable<string>;
}

// src/lib/ports/EmbeddingModel (conceptual)
interface EmbeddingModel {
  embed(text: string): Promise<number[]>;
}
```

### Consumers
- `src/lib/agents/search/` — SearchAgent, APISearchAgent, Researcher
- `src/lib/http/sessionStream.ts` — SSE streaming
- `src/app/api/search/route.ts` — API search endpoint
- `src/app/api/chat/route.ts` — Chat API endpoint
- `src/lib/services/ChatService.ts` — Application service

---

## Target State

### SDK Provider Mapping
| Current Provider | Vercel AI SDK Package | Notes |
|---|---|---|
| openai | `@ai-sdk/openai` | Official. Covers GPT-4, GPT-5, o1-o4, embeddings |
| anthropic | `@ai-sdk/anthropic` | Official |
| gemini | `@ai-sdk/google` | Official. Covers Gemini chat + embeddings |
| groq | `@ai-sdk/groq` | Official |
| ollama | `nordwestt/ollama-ai-provider-v2` | Community. Best maintained option |
| lmstudio | `@ai-sdk/openai-compatible` | With `baseURL` config |
| lemonade | `@ai-sdk/openai-compatible` | With `baseURL` config |
| transformers | **Custom adapter** | No SDK provider. Keep current implementation behind port |

### Architecture After Migration
```
src/lib/models/
  registry.ts              — createProviderRegistry() from SDK
  types.ts                 — Updated interfaces mapping to SDK LanguageModel/EmbeddingModel
  providers/
    openai.ts              — @ai-sdk/openai provider factory
    anthropic.ts           — @ai-sdk/anthropic provider factory
    gemini.ts              — @ai-sdk/google provider factory
    groq.ts                — @ai-sdk/groq provider factory
    ollama.ts              — ollama-ai-provider-v2 factory
    openaiCompatible.ts    — @ai-sdk/openai-compatible factory (LM Studio + Lemonade)
    transformers.ts        — Custom adapter (unchanged internally, new wrapper)
```

---

## Phased Migration Plan

### Phase 1: Install SDK + Create Provider Factories
**Branch:** `feat/vercel-ai-sdk-providers`
**Files changed:** ~10 new/modified
**Risk:** Low — additive only, no existing code broken

1. Install dependencies:
   ```bash
   npm install ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google @ai-sdk/groq @ai-sdk/openai-compatible ollama-ai-provider-v2 --legacy-peer-deps
   ```

2. Create provider factory functions in `src/lib/models/providers/`:
   ```typescript
   // openai.ts
   import { createOpenAI } from '@ai-sdk/openai';
   export const createOpenAIProvider = (config: { apiKey: string }) => createOpenAI({ apiKey: config.apiKey });
   ```

3. Create a new `src/lib/models/sdkRegistry.ts` that wraps `createProviderRegistry()`:
   ```typescript
   import { createProviderRegistry } from 'ai';
   export const registry = createProviderRegistry({
     openai: createOpenAIProvider,
     anthropic: createAnthropicProvider,
     // ...
   });
   ```

4. Write unit tests for each factory function.

### Phase 2: Update ModelRegistry to Use SDK Providers
**Branch:** `feat/vercel-ai-sdk-registry`
**Files changed:** `ModelRegistry.ts`, `composition.ts`, ~5 files
**Risk:** Medium — changes the core registry consumers depend on

1. Refactor `ModelRegistry` to store SDK `LanguageModel` and `EmbeddingModel` instances instead of custom provider instances.

2. Update `getActiveProviders()` to return SDK-compatible model metadata.

3. Update `composition.ts` to wire SDK providers.

4. **Critical:** Ensure the `/api/providers` endpoint still returns the same response shape. The frontend (`useChatConfig`, `ChatModelSelector`) depends on the `MinimalProvider[]` shape with `chatModels[]` and `embeddingModels[]`.

### Phase 3: Migrate Chat/Stream Consumers
**Branch:** `feat/vercel-ai-sdk-streaming`
**Files changed:** `sessionStream.ts`, `SearchAgent`, `APISearchAgent`, `Researcher`, `ChatService`
**Risk:** High — streaming contract changes

1. Replace custom `streamText` calls with Vercel `streamText()`:
   ```typescript
   import { streamText } from 'ai';
   const result = streamText({
     model: registry.languageModel('openai/gpt-4'),
     prompt: '...',
   });
   ```

2. Update `sessionStream.ts` SSE format to match Vercel AI SDK's `StreamData` format.

3. Update `useChatStream.ts` frontend hook to parse new stream format.

4. **Critical test:** End-to-end streaming must work — search results, chat responses, think tags.

### Phase 4: Migrate Embedding Consumers
**Branch:** `feat/vercel-ai-sdk-embeddings`
**Files changed:** VectorStore consumers, search indexing
**Risk:** Low — embeddings are batch operations

1. Replace custom `embed()` calls with Vercel `embed()`:
   ```typescript
   import { embed } from 'ai';
   const { embedding } = await embed({
     model: registry.textEmbeddingModel('openai/text-embedding-3-small'),
     value: 'text to embed',
   });
   ```

2. Keep Transformers.js as a custom adapter — it runs in-process and has no SDK equivalent.

3. Update VectorStore adapter to accept SDK embedding results.

### Phase 5: Dynamic Model Lists + Cleanup
**Branch:** `feat/vercel-ai-sdk-dynamic-models`
**Files changed:** Provider configs, hardcoded model lists
**Risk:** Low — removing hardcoded data

1. Use Vercel AI SDK's `provider.listModels()` where available to fetch dynamic model lists.

2. Remove hardcoded model arrays from OpenAI provider (currently 20 chat + 2 embedding models).

3. Remove hardcoded Transformers.js model list (currently 3 models).

4. Clean up old provider files (`openaiLLM.ts`, `anthropicLLM.ts`, etc.).

### Phase 6: Integration Tests + Documentation
**Branch:** `feat/vercel-ai-sdk-integration`
**Files changed:** Test files, README
**Risk:** Low — verification only

1. Write integration tests for each provider with actual API calls (optional, behind feature flags).

2. Update README with new provider configuration docs.

3. Update CHANGELOG.md.

---

## Risk Matrix

| Risk | Impact | Mitigation |
|---|---|---|
| Streaming format changes | High — breaks SSE for all clients | Phase 3 has dedicated branch. Test with real providers before merge. |
| Ollama community provider instability | Medium — Ollama users affected | Pin exact version. Fallback: use `@ai-sdk/openai-compatible` with Ollama's OpenAI endpoint. |
| Transformers.js no SDK support | Low — keep current implementation | Custom adapter behind port interface. No changes needed. |
| SDK v5 vs v6 beta | Medium — API surface changes | Use v5 stable (current). Document v6 migration path when released. |
| Dynamic model list API gaps | Low — some providers don't support it | Keep fallback hardcoded lists where needed. |
| Large dependency tree | Low — SDK adds ~10 packages | Tree-shaking. Bundle analysis. |

---

## Dependency List

### Production
```
ai                          — Core SDK
@ai-sdk/openai              — OpenAI provider
@ai-sdk/anthropic           — Anthropic provider
@ai-sdk/google              — Gemini provider
@ai-sdk/groq                — Groq provider
@ai-sdk/openai-compatible   — LM Studio, Lemonade, any OpenAI API
ollama-ai-provider-v2       — Ollama community provider
```

### Remove (replaced by SDK)
```
openai                      — Replaced by @ai-sdk/openai
@google/generative-ai       — Replaced by @ai-sdk/google
anthropic                   — Replaced by @ai-sdk/anthropic
```

### Keep (not replaced)
```
better-sqlite3              — Database
sqlite-vec                  — Vector search
drizzle-orm                 — ORM
next                        — Framework
```

---

## Open Questions

1. **Ollama provider choice**: `ollama-ai-provider-v2` (community) vs `@ai-sdk/openai-compatible` with Ollama's `/v1` endpoint. Recommendation: start with community provider, fallback to openai-compatible if issues.

2. **Streaming backwards compatibility**: The frontend `useChatStream.ts` parses a custom SSE format. Vercel AI SDK has its own format. Need to decide: migrate frontend to SDK format, or translate in `sessionStream.ts`.

3. **Tool calls**: Vercel AI SDK supports structured tool calls. Current code has a simple prompt-based approach. Migration could enable proper tool use.

4. **Version pinning**: Pin to `ai@^5` (stable) or test with `ai@^6` (beta when available)?

---

## Success Criteria

- [ ] All 8 providers work through Vercel AI SDK (except Transformers.js custom adapter)
- [ ] Streaming works end-to-end: search, chat, think tags
- [ ] Model selection from UI works identically to current behavior
- [ ] All existing tests pass + new provider factory tests
- [ ] Hardcoded model lists replaced with dynamic discovery where possible
- [ ] Docker image size increase < 20MB
- [ ] Bundle size increase < 50KB gzipped
