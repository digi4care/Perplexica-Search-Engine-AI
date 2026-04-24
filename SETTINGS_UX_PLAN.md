# Settings UX & Search Language Plan

## Problem Statement

De Settings modal heeft meerdere UX en architectuur problemen:
1. "Active Models" toont lege dropdowns wanneer geen providers geconfigureerd zijn
2. OpenAI heeft 20 hardcoded modelnamen in plaats van dynamische API fetch
3. SearXNG URL setting werkt niet correct (geen validatie, crasht bij lege URL)
4. Geen taal/regio selectie — SearXNG ondersteunt `language` param maar wordt nooit doorgegeven
5. Geen search categories/description UI
6. Alles is Engels — geen i18n infrastructuur

## Analysis Results

### Provider/Model System

| Provider | Model Listing | Installed SDK |
|----------|:------------:|:------------:|
| OpenAI | **HARDCODED** (20+2) | @ai-sdk/openai |
| Anthropic | Dynamic (/v1/models) | @ai-sdk/anthropic |
| Gemini | Dynamic (/v1beta/models) | @ai-sdk/google |
| Groq | Dynamic (/openai/v1/models) | @ai-sdk/groq |
| Ollama | Dynamic (/api/tags) | ollama-ai-provider-v2 |
| LM Studio | Dynamic (/v1/models) | @ai-sdk/openai-compatible |
| Lemonade | Dynamic (/models) | @ai-sdk/openai-compatible |
| Transformers | **HARDCODED** (3 local) | @huggingface/transformers |

Key: Vercel AI SDK heeft **geen** `listModels()` API. Model listing gebeurt via raw HTTP fetch per provider.

### SearXNG Bugs

1. **Lege URL = crash**: `new URL('/search?format=json')` faalt wanneer searxngURL leeg is
2. **Discover hardcoded 'en'**: `language: 'en'` in discover route
3. **3 files bypassen adapter**: image.ts, video.ts, discover/route.ts import searchSearxng direct
4. **Language param wordt nooit doorgegeven**: SearchOptions.language bestaat maar niemand gebruikt het

### i18n Status

- **Nul infrastructuur** — geen library, geen locale files, geen language switching
- ~150-200 hardcoded Engelse strings over ~55 componenten
- 7 locaties met hardcoded 'en-US' datum/nummer formatting
- `html lang="en"` hardcoded in layout.tsx

### User Requirements

1. Provider Connections moet ALLE Vercel AI SDK providers tonen (dynamisch)
2. OpenAI moet modellen dynamisch fetchen via `/v1/models` API
3. Search settings: taal, regio, categorie selectie
4. SearXNG URL moet gevalideerd worden + graceful error
5. UI moet meertalig kunnen zijn (minimaal nl-NL + en-US)
6. "Active Models" verbergen wanneer geen providers actief
7. Search language los van UI language

---

## Execution Plan (Phased)

### Phase 1: Search Language & SearXNG Fix
**Doel**: SearXNG instellingen werkend + taal/regio selectie in search

#### Task 1.1: SearXNG URL validation + empty state guard
- **Files**: `src/lib/searxng.ts`, `src/components/Settings/Sections/Search.tsx`
- **Wat**: 
  - Valideer URL format in searxng.ts (geen crash bij lege URL)
  - Toon duidelijke error message wanneer SearXNG onbereikbaar
  - Test URL connectivity bij opslaan (fetch /search?q=test&format=json)
- **Test**: Unit test voor lege/ongeldige URLs, integration test voor valid flow

#### Task 1.2: Search language config field
- **Files**: `src/lib/config/configDefaults.ts`, `src/lib/config/types.ts`, `src/lib/searxng.ts`, `src/lib/ports/searchBackend.ts`
- **Wat**:
  - Voeg `searchLanguage` (select: nl, en, de, fr, etc.) en `searchRegion` (select: NL, US, DE, FR, etc.) toe aan config
  - Wire language param door naar searchSearxng() calls
  - Update SearchOptions interface
- **Test**: Config save/load test, SearXNG language param test

#### Task 1.3: Wire language to all search actions
- **Files**: `src/lib/agents/search/researcher/actions/search/webSearch.ts`, `academicSearch.ts`, `socialSearch.ts`, `searchHelpers.ts`, `src/app/api/discover/route.ts`, `src/lib/agents/media/image.ts`, `video.ts`
- **Wat**:
  - Alle search actions lezen searchLanguage uit config en geven door
  - Discover route gebruikt config language ipv hardcoded 'en'
  - Fix 3 direct imports (image, video, discover) om SearchBackend port te gebruiken
- **Test**: Per-action test dat language param wordt doorgegeven

#### Task 1.4: Search settings UI — language, region, categories
- **Files**: `src/lib/config/configDefaults.ts`, search UI components
- **Wat**:
  - Nieuwe config fields: searchLanguage (select), searchRegion (select)
  - Render in Settings > Search tab
  - Per-query language override in search input (optional toggle)
- **Test**: UI test voor language selectie

### Phase 2: Models Tab UX Fix
**Doel**: Geen hardcoded modellen meer, clean empty states

#### Task 2.1: OpenAI dynamic model fetching
- **Files**: `src/lib/models/providers/openai/index.ts`
- **Wat**:
  - Vervang hardcoded arrays door fetch naar `/v1/models` API
  - Keep hardcoded als fallback wanneer API unreachable
  - Werkt ook voor custom baseURL (momenteel retourneert die empty)
- **Test**: Unit test met mock API, fallback test

#### Task 2.2: Active Models empty state
- **Files**: `src/components/Settings/Sections/Models/Section.tsx`, `ModelSelect.tsx`
- **Wat**:
  - Verberg "Active Models" sectie wanneer geen providers met geldige modellen
  - Toon placeholder tekst met link naar "Add your first connection"
  - Disable ModelSelect dropdowns wanneer leeg
- **Test**: Render test met lege en gevulde provider arrays

#### Task 2.3: Provider connection discovery
- **Files**: `src/lib/models/providers/index.ts`, `AddProviderDialog.tsx`
- **Wat**:
  - AddProviderDialog toont alle 8 providers met iconen
  - Beschrijving per provider type
  - Duidelijke "supported" vs "coming soon" labeling
- **Test**: UI test voor provider selectie

### Phase 3: i18n Foundation
**Doel**: Meertaligheid mogelijk maken (later uitbreidbaar)

#### Task 3.1: Install + configure paraglide-js
- **Files**: `package.json`, `next.config.mjs`, `src/lib/i18n/` (new), `messages/` (new)
- **Wat**:
  - Installeer @inlang/paraglide-js
  - Configureer met nl-NL en en-US
  - Maak message files aan
  - Voeg middleware toe voor locale detection
- **Test**: Basis message rendering test

#### Task 3.2: Extract settings strings to messages
- **Files**: Alle Settings/ componenten
- **Wat**:
  - ~50 strings uit Settings/Models/ extraheren
  - ~15 strings uit Settings tabs/extras
  - Vertaal naar nl-NL
- **Test**: Snapshot tests voor beide locales

#### Task 3.3: Extract remaining UI strings
- **Files**: Chat, Sidebar, Navbar, MessageBox, EmptyChat, etc.
- **Wat**:
  - ~100 remaining strings extraheren
  - Fix 7 hardcoded 'en-US' locale calls
  - Vertaal naar nl-NL
- **Test**: Full app render test per locale

#### Task 3.4: Language selector UI
- **Files**: Settings Preferences section, layout.tsx
- **Wat**:
  - UI language selector in Settings > Preferences
  - Update html lang attribute dynamisch
  - Persist in config + localStorage
- **Test**: Language switch integration test

---

## Priority Order

1. **Phase 1** (Search Language) — hoogste impact, lost meerdere bugs op
2. **Phase 2** (Models UX) — verwijdert hardcoded zooi, verbetert UX
3. **Phase 3** (i18n) — grootste scope, maar fundamenteel voor meertaligheid

## Non-Goals

- Nieuwe providers toevoegen (Mistral, Cohere, etc.) — later
- Search engine selector (Google vs Bing vs DuckDuckGo) — SearXNG regelt dit
- Full accessibility audit — aparte fase
