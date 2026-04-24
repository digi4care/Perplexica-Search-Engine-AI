import { describe, it, expect, vi, beforeEach } from 'vitest';

// Must import after mocking or test will hit real DB/network constructors.
// We test structural properties (instance types, singleton behavior) only.

import {
  getMessageStore,
  getSearchBackend,
  createSearchAgent,
  createApiSearchAgent,
  getModelRegistry,
  reloadModelRegistry,
  resetAdapters,
  injectAdapters,
} from '@/lib/composition';

describe('Composition root', () => {
  beforeEach(() => {
    resetAdapters();
  });

  it('getMessageStore returns a DrizzleMessageStore-like object', () => {
    const store = getMessageStore();
    expect(store).toBeDefined();
    expect(typeof store.findMessage).toBe('function');
    expect(typeof store.insertMessage).toBe('function');
    expect(typeof store.deleteMessagesAfter).toBe('function');
    expect(typeof store.updateMessage).toBe('function');
  });

  it('getSearchBackend returns a SearxngSearchBackend-like object', () => {
    const backend = getSearchBackend();
    expect(backend).toBeDefined();
    expect(typeof backend.search).toBe('function');
  });

  it('createSearchAgent returns a SearchAgent instance', () => {
    const agent = createSearchAgent();
    expect(agent).toBeDefined();
    expect(typeof agent.searchAsync).toBe('function');
  });

  it('createApiSearchAgent returns an APISearchAgent instance', () => {
    const agent = createApiSearchAgent();
    expect(agent).toBeDefined();
    expect(typeof agent.searchAsync).toBe('function');
  });

  it('getMessageStore returns the same instance on repeated calls', () => {
    const store1 = getMessageStore();
    const store2 = getMessageStore();
    expect(store1).toBe(store2);
  });

  it('getSearchBackend returns the same instance on repeated calls', () => {
    const backend1 = getSearchBackend();
    const backend2 = getSearchBackend();
    expect(backend1).toBe(backend2);
  });

  it('resetAdapters clears singletons so next call creates new instances', () => {
    const store1 = getMessageStore();
    resetAdapters();
    const store2 = getMessageStore();
    expect(store1).not.toBe(store2);
  });

  it('injectAdapters allows overriding the messageStore', () => {
    const mockStore = {
      findMessage: vi.fn(),
      insertMessage: vi.fn(),
      deleteMessagesAfter: vi.fn(),
      updateMessage: vi.fn(),
    };

    injectAdapters({ messageStore: mockStore as any });

    const store = getMessageStore();
    expect(store).toBe(mockStore);
  });

  it('injectAdapters allows overriding the searchBackend', () => {
    const mockBackend = {
      search: vi.fn(),
    };

    injectAdapters({ searchBackend: mockBackend as any });

    const backend = getSearchBackend();
    expect(backend).toBe(mockBackend);
  });

  it('injectAdapters partial override leaves other singleton intact', () => {
    const realStore = getMessageStore();
    const mockBackend = { search: vi.fn() };

    injectAdapters({ searchBackend: mockBackend as any });

    expect(getMessageStore()).toBe(realStore);
    expect(getSearchBackend()).toBe(mockBackend);
  });
});

describe('ModelRegistry singleton', () => {
  beforeEach(() => {
    resetAdapters();
  });

  it('getModelRegistry returns a registry with activeProviders', () => {
    const registry = getModelRegistry();
    expect(registry).toBeDefined();
    expect(typeof registry.loadChatModel).toBe('function');
    expect(typeof registry.loadEmbeddingModel).toBe('function');
    expect(Array.isArray(registry.activeProviders)).toBe(true);
  });

  it('getModelRegistry returns the same instance on repeated calls', () => {
    const reg1 = getModelRegistry();
    const reg2 = getModelRegistry();
    expect(reg1).toBe(reg2);
  });

  it('resetAdapters clears registry so next call creates new instance', () => {
    const reg1 = getModelRegistry();
    resetAdapters();
    const reg2 = getModelRegistry();
    expect(reg1).not.toBe(reg2);
  });

  it('reloadModelRegistry reinitializes providers without creating a new registry', () => {
    const reg = getModelRegistry();
    const originalProviders = [...reg.activeProviders];
    reloadModelRegistry();
    // Same instance, but providers array may have been rebuilt
    expect(reg).toBe(getModelRegistry());
    // Provider count should be the same (same config)
    expect(reg.activeProviders.length).toBe(originalProviders.length);
  });

  it('reloadModelRegistry is a no-op when no registry exists yet', () => {
    // Should not throw
    expect(() => reloadModelRegistry()).not.toThrow();
  });
});
