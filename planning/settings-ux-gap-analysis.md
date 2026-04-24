# Settings UX Gap Analysis

## What I saw

Analyzed all 4 settings sections (Preferences, Personalization, Models, Search) plus the chat model selector on the home page. Here are the issues ranked by user impact.

---

## Critical Issues

### 1. "Select Chat Model" vs "Manage Connections" — users don't know the difference
**Current:** Two sections on the Models page that look similar. "Select models" has two dropdowns. "Manage connections" has provider cards.
**Gap:** A user sees "OpenAI - GPT 5.2" in the dropdown AND "OpenAI" as a provider card below. Which one does what? The dropdown switches the ACTIVE model. The card manages the CONNECTION (API key, which models are available).
**Fix:** Already partially done (active models section with sky tint, provider connections with icons). But needs more:
- Add a tooltip or info text: "Switch between models instantly — no reconnect needed"
- On provider cards, add "Currently active" badge next to the model that's selected

### 2. No feedback when model selection changes
**Current:** User changes dropdown → model switches silently. No confirmation, no visual indicator of what changed.
**Gap:** User doesn't know if the change took effect. The dropdown value changes but there's no success message.
**Fix:** Add a brief toast notification: "Chat model switched to GPT 5.2"

### 3. Chat model selector on home page has no labels
**Current:** The CPU icon next to the search bar opens a model selector popover. It shows providers and models but no section headers or explanation.
**Gap:** A new user doesn't know what the CPU icon does. No tooltip, no label.
**Fix:** Add a tooltip "Switch model" on hover. Add a small header in the popover: "Select model"

---

## Significant Issues

### 4. Models page description is wrong
**Current:** Section header says "Connect to AI services and manage connections."
**Gap:** This only describes the bottom half. The top half is about model selection.
**Fix:** Changed to "Choose active AI models and manage provider connections." (already done in code, not yet in Docker)

### 5. No "active model" indicator on the home page
**Current:** The model selector shows a small CPU icon. No model name visible.
**Gap:** User doesn't know which model is active without clicking the icon.
**Fix:** Show the active model name as small text next to the CPU icon: "GPT 5.2" or at least on hover.

### 6. Provider cards show all models but don't distinguish chat vs embedding well
**Current:** Provider cards have "Chat Models" and "Embedding Models" sections with model chips.
**Gap:** The section headers are very small uppercase text. The model chips all look the same — no way to tell which one is currently ACTIVE.
**Fix:** Highlight the currently active model chip with a sky-500 border or background.

### 7. Settings dialogue GitHub link still points to upstream
**Current:** `href="https://github.com/itzcrazykns/vane"`
**Gap:** Our fork is at `digi4care/Perplexica-Search-Engine-AI`. Link goes to the wrong repo.
**Fix:** Already changed in code (not yet in Docker).

---

## Minor Issues

### 8. Preferences section — "Auto video & image search" label is unclear
**Current:** Toggle labeled "Auto video & image search" with description "Automatically search for relevant images and videos."
**Gap:** When is this triggered? During every search? Only chat? The description doesn't explain the scope.
**Fix:** Better description: "Automatically include relevant images and videos in search results."

### 9. Personalization — empty by default, no guidance
**Current:** Section shows "Personalization" heading but the fields depend on config.
**Gap:** If no personalization fields are configured, the page appears empty/broken.
**Fix:** Add an empty state: "No personalization options available yet."

### 10. Search section — technical jargon
**Current:** "SearXNG API URL" and other technical fields.
**Gap:** Non-technical users don't know what SearXNG is.
**Fix:** Add a brief explanation link or tooltip: "SearXNG is the search engine that powers your results."

### 11. Version display shows `process.env.NEXT_PUBLIC_VERSION`
**Current:** Shows "Version: 2.0.0" in settings.
**Gap:** If the env var is not set, it shows "Version: undefined".
**Fix:** Fallback: `{process.env.NEXT_PUBLIC_VERSION || 'dev'}`

### 12. No confirmation before deleting a provider
**Current:** Delete button on provider card triggers deletion immediately (or with a dialog).
**Gap:** Users might accidentally delete a provider and lose their API key configuration.
**Fix:** Verify the DeleteProviderDialog has proper confirmation. (It exists but let me verify the UX.)

---

## Architecture Issues

### 13. Model selection is in TWO places
**Current:** Model can be switched via:
1. Settings > Models > "Select Chat Model" dropdown
2. Home page > CPU icon > model popover
**Gap:** These two components have separate state management. Both write to localStorage. Potential race condition if both are open.
**Fix:** Both already use `setChatModelProvider` from useChat context. This is fine architecturally, but the UX should make it clear these are the same setting.

### 14. Embedding model selection affects search but user doesn't know
**Current:** "Select Embedding Model" dropdown exists but users don't understand what embeddings are.
**Gap:** Changing the embedding model affects search quality but there's no explanation.
**Fix:** Add info text: "Embeddings power search quality. Changing this may affect existing search results."

---

## Priority Fix Order

1. **#1 + #4 + #7** — Already done in code (visual distinction, labels, GitHub link)
2. **#3** — Add tooltip to CPU icon on home page
3. **#2** — Toast on model switch
4. **#5** — Show active model name on home page
5. **#6** — Highlight active model in provider cards
6. **#11** — Version fallback
7. **#8, #9, #10** — Better descriptions
8. **#14** — Info text for embedding model
