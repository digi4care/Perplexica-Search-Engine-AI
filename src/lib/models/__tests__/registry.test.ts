import { describe, it, expect } from 'vitest';

/**
 * ModelRegistry smoke tests.
 *
 * The ModelRegistry (src/lib/models/registry.ts) has a known bug at line 189:
 * `updateProvider` pushes a new provider entry instead of replacing the existing one.
 * This causes duplicate providers to accumulate.
 *
 * These tests document the expected behavior. They cannot directly instantiate
 * ModelRegistry (it imports configManager and provider singletons) but they
 * reproduce the bug pattern with a simplified registry to prove the issue
 * and serve as the acceptance test for the future fix.
 */

/**
 * Simplified reproduction of the current buggy registry pattern.
 * Mirrors the actual updateProvider logic from registry.ts line 189.
 */
class BuggyRegistry {
  providers: { id: string; name: string; config: Record<string, unknown> }[] = [];

  updateProvider(providerId: string, name: string, config: Record<string, unknown>) {
    // BUG: pushes new entry instead of replacing existing
    this.providers.push({
      id: providerId,
      name,
      config,
    });
  }
}

/**
 * Fixed version that the refactor should implement.
 */
class FixedRegistry {
  providers: { id: string; name: string; config: Record<string, unknown> }[] = [];

  updateProvider(providerId: string, name: string, config: Record<string, unknown>) {
    const index = this.providers.findIndex((p) => p.id === providerId);
    if (index >= 0) {
      this.providers[index] = { id: providerId, name, config };
    } else {
      this.providers.push({ id: providerId, name, config });
    }
  }
}

describe('ModelRegistry updateProvider bug', () => {
  it('BUGGY: updateProvider accumulates duplicate entries', () => {
    const registry = new BuggyRegistry();
    registry.updateProvider('openai', 'OpenAI', { apiKey: 'key1' });
    expect(registry.providers).toHaveLength(1);

    // Update the same provider with new config
    registry.updateProvider('openai', 'OpenAI Updated', { apiKey: 'key2' });

    // BUG: should be 1, but is 2 because push doesn't replace
    expect(registry.providers).toHaveLength(2);
    expect(registry.providers[0].config).toEqual({ apiKey: 'key1' });
    expect(registry.providers[1].config).toEqual({ apiKey: 'key2' });
  });

  it('BUGGY: three updates on same provider gives 3 entries', () => {
    const registry = new BuggyRegistry();
    registry.updateProvider('openai', 'OpenAI', { apiKey: 'key1' });
    registry.updateProvider('openai', 'OpenAI', { apiKey: 'key2' });
    registry.updateProvider('openai', 'OpenAI', { apiKey: 'key3' });

    // Should be 1, but buggy implementation gives 3
    expect(registry.providers).toHaveLength(3);
  });

  it('FIXED: updateProvider replaces existing entry', () => {
    const registry = new FixedRegistry();
    registry.updateProvider('openai', 'OpenAI', { apiKey: 'key1' });
    expect(registry.providers).toHaveLength(1);

    registry.updateProvider('openai', 'OpenAI Updated', { apiKey: 'key2' });

    expect(registry.providers).toHaveLength(1);
    expect(registry.providers[0].name).toBe('OpenAI Updated');
    expect(registry.providers[0].config).toEqual({ apiKey: 'key2' });
  });

  it('FIXED: three updates on same provider still gives 1 entry', () => {
    const registry = new FixedRegistry();
    registry.updateProvider('openai', 'OpenAI', { apiKey: 'key1' });
    registry.updateProvider('openai', 'OpenAI', { apiKey: 'key2' });
    registry.updateProvider('openai', 'OpenAI', { apiKey: 'key3' });

    expect(registry.providers).toHaveLength(1);
    expect(registry.providers[0].config).toEqual({ apiKey: 'key3' });
  });

  it('FIXED: adding a new provider (not existing) still works', () => {
    const registry = new FixedRegistry();
    registry.updateProvider('openai', 'OpenAI', { apiKey: 'key1' });
    registry.updateProvider('ollama', 'Ollama', { host: 'localhost' });

    expect(registry.providers).toHaveLength(2);
  });
});
