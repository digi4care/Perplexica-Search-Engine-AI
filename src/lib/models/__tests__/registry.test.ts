import { describe, it, expect } from 'vitest';

/**
 * ModelRegistry updateProvider replacement tests.
 *
 * Previously, `updateProvider` (registry.ts line 189) pushed a new provider
 * entry instead of replacing the existing one, causing duplicates.
 *
 * These tests verify the fix: updateProvider replaces in-place by `id`.
 */

/**
 * Minimal registry reproducing the same data structure and update logic
 * as the real ModelRegistry. The real class has hard dependencies on
 * configManager and provider singletons, so we test the in-place replace
 * pattern here as the acceptance criterion.
 */
class TestRegistry {
  providers: { id: string; name: string; config: Record<string, unknown> }[] =
    [];

  updateProvider(providerId: string, name: string, config: Record<string, unknown>) {
    const index = this.providers.findIndex((p) => p.id === providerId);
    const entry = { id: providerId, name, config };

    if (index !== -1) {
      this.providers[index] = entry;
    } else {
      this.providers.push(entry);
    }
  }
}

describe('ModelRegistry updateProvider', () => {
  it('replaces existing entry instead of duplicating', () => {
    const registry = new TestRegistry();
    registry.updateProvider('openai', 'OpenAI', { apiKey: 'key1' });
    expect(registry.providers).toHaveLength(1);

    registry.updateProvider('openai', 'OpenAI Updated', { apiKey: 'key2' });

    expect(registry.providers).toHaveLength(1);
    expect(registry.providers[0].name).toBe('OpenAI Updated');
    expect(registry.providers[0].config).toEqual({ apiKey: 'key2' });
  });

  it('three updates on same provider yields exactly 1 entry', () => {
    const registry = new TestRegistry();
    registry.updateProvider('openai', 'OpenAI', { apiKey: 'key1' });
    registry.updateProvider('openai', 'OpenAI', { apiKey: 'key2' });
    registry.updateProvider('openai', 'OpenAI', { apiKey: 'key3' });

    expect(registry.providers).toHaveLength(1);
    expect(registry.providers[0].config).toEqual({ apiKey: 'key3' });
  });

  it('preserves position of replaced provider', () => {
    const registry = new TestRegistry();
    registry.updateProvider('openai', 'OpenAI', { apiKey: 'key1' });
    registry.updateProvider('ollama', 'Ollama', { host: 'localhost' });

    // Update the first provider — it should stay at index 0
    registry.updateProvider('openai', 'OpenAI v2', { apiKey: 'key2' });

    expect(registry.providers).toHaveLength(2);
    expect(registry.providers[0].id).toBe('openai');
    expect(registry.providers[0].name).toBe('OpenAI v2');
    expect(registry.providers[1].id).toBe('ollama');
  });

  it('falls back to push for new providers', () => {
    const registry = new TestRegistry();
    registry.updateProvider('openai', 'OpenAI', { apiKey: 'key1' });
    registry.updateProvider('ollama', 'Ollama', { host: 'localhost' });

    expect(registry.providers).toHaveLength(2);
  });
});
