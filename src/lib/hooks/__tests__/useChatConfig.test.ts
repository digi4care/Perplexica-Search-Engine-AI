// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toast } from 'sonner';
import { useChatConfig } from '../useChatConfig';

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

const mockProviders = () => [
  {
    id: 'openai',
    name: 'OpenAI',
    chatModels: [
      { name: 'GPT-4', key: 'gpt-4' },
      { name: 'GPT-3.5', key: 'gpt-3.5-turbo' },
    ],
    embeddingModels: [
      { name: 'text-embedding-3-small', key: 'text-embedding-3-small' },
    ],
  },
  {
    id: 'ollama',
    name: 'Ollama',
    chatModels: [{ name: 'Llama 3', key: 'llama3' }],
    embeddingModels: [{ name: 'nomic-embed', key: 'nomic-embed-text' }],
  },
];

function mockFetchSuccess(providers: any[] = mockProviders()) {
  (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
    if (url === '/api/config') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ values: { preferences: {} } }),
      });
    }
    if (url === '/api/providers') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ providers }),
      });
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
  });
}

function mockFetchError(status: number = 500) {
  (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
    if (url === '/api/config') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ values: { preferences: {} } }),
      });
    }
    // /api/providers fails
    return Promise.resolve({
      ok: false,
      status,
      json: () => Promise.resolve({}),
    });
  });
}


describe('useChatConfig', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns initial state before config loads', () => {
    mockFetchSuccess();
    const { result } = renderHook(() => useChatConfig());

    expect(result.current.chatModelProvider).toEqual({ key: '', providerId: '' });
    expect(result.current.embeddingModelProvider).toEqual({ key: '', providerId: '' });
    expect(result.current.isConfigReady).toBe(false);
    expect(result.current.hasError).toBe(false);
  });

  it('exposes setter functions', () => {
    mockFetchSuccess();
    const { result } = renderHook(() => useChatConfig());

    expect(typeof result.current.setChatModelProvider).toBe('function');
    expect(typeof result.current.setEmbeddingModelProvider).toBe('function');
  });

  it('loads config from localStorage and API on mount', async () => {
    localStorage.setItem('chatModelKey', 'gpt-4');
    localStorage.setItem('chatModelProviderId', 'openai');
    localStorage.setItem('embeddingModelKey', 'nomic-embed-text');
    localStorage.setItem('embeddingModelProviderId', 'ollama');

    mockFetchSuccess();

    const { result } = renderHook(() => useChatConfig());

    await waitFor(() => expect(result.current.isConfigReady).toBe(true));

    expect(result.current.chatModelProvider).toEqual({
      key: 'gpt-4',
      providerId: 'openai',
    });
    expect(result.current.embeddingModelProvider).toEqual({
      key: 'nomic-embed-text',
      providerId: 'ollama',
    });
  });

  it('falls back to first provider when stored chat provider ID is not found', async () => {
    localStorage.setItem('chatModelKey', 'some-key');
    localStorage.setItem('chatModelProviderId', 'nonexistent');
    localStorage.setItem('embeddingModelKey', 'nomic-embed-text');
    localStorage.setItem('embeddingModelProviderId', 'ollama');

    mockFetchSuccess();

    const { result } = renderHook(() => useChatConfig());

    await waitFor(() => expect(result.current.isConfigReady).toBe(true));

    // Falls back to first provider with chatModels (openai)
    expect(result.current.chatModelProvider.providerId).toBe('openai');
  });

  it('falls back to first provider when stored embedding provider ID is not found', async () => {
    localStorage.setItem('chatModelKey', 'gpt-4');
    localStorage.setItem('chatModelProviderId', 'openai');
    localStorage.setItem('embeddingModelKey', 'some-key');
    localStorage.setItem('embeddingModelProviderId', 'nonexistent');

    mockFetchSuccess();

    const { result } = renderHook(() => useChatConfig());

    await waitFor(() => expect(result.current.isConfigReady).toBe(true));

    // Falls back to first provider with embeddingModels (openai)
    expect(result.current.embeddingModelProvider.providerId).toBe('openai');
  });

  it('falls back to first model when stored chat model key is not found', async () => {
    localStorage.setItem('chatModelKey', 'nonexistent-model');
    localStorage.setItem('chatModelProviderId', 'openai');
    localStorage.setItem('embeddingModelKey', 'text-embedding-3-small');
    localStorage.setItem('embeddingModelProviderId', 'openai');

    mockFetchSuccess();

    const { result } = renderHook(() => useChatConfig());

    await waitFor(() => expect(result.current.isConfigReady).toBe(true));

    // Falls back to first model in provider: gpt-4
    expect(result.current.chatModelProvider.key).toBe('gpt-4');
  });

  it('falls back to first model when stored embedding model key is not found', async () => {
    localStorage.setItem('chatModelKey', 'gpt-4');
    localStorage.setItem('chatModelProviderId', 'openai');
    localStorage.setItem('embeddingModelKey', 'nonexistent-embed');
    localStorage.setItem('embeddingModelProviderId', 'openai');

    mockFetchSuccess();

    const { result } = renderHook(() => useChatConfig());

    await waitFor(() => expect(result.current.isConfigReady).toBe(true));

    // Falls back to first embedding model in provider
    expect(result.current.embeddingModelProvider.key).toBe('text-embedding-3-small');
  });

  it('sets isConfigReady to true on success', async () => {
    mockFetchSuccess();

    const { result } = renderHook(() => useChatConfig());

    await waitFor(() => expect(result.current.isConfigReady).toBe(true));

    expect(result.current.hasError).toBe(false);
  });

  it('saves selected values to localStorage', async () => {
    localStorage.setItem('chatModelKey', 'gpt-4');
    localStorage.setItem('chatModelProviderId', 'openai');
    localStorage.setItem('embeddingModelKey', 'nomic-embed-text');
    localStorage.setItem('embeddingModelProviderId', 'ollama');

    mockFetchSuccess();

    const { result } = renderHook(() => useChatConfig());

    await waitFor(() => expect(result.current.isConfigReady).toBe(true));

    expect(localStorage.getItem('chatModelKey')).toBe('gpt-4');
    expect(localStorage.getItem('chatModelProviderId')).toBe('openai');
    expect(localStorage.getItem('embeddingModelKey')).toBe('nomic-embed-text');
    expect(localStorage.getItem('embeddingModelProviderId')).toBe('ollama');
  });

  it('updates localStorage when falling back to defaults', async () => {
    // No localStorage values set → should get defaults saved
    mockFetchSuccess();

    const { result } = renderHook(() => useChatConfig());

    await waitFor(() => expect(result.current.isConfigReady).toBe(true));

    expect(localStorage.getItem('chatModelKey')).toBe('gpt-4');
    expect(localStorage.getItem('chatModelProviderId')).toBe('openai');
    expect(localStorage.getItem('embeddingModelKey')).toBe('text-embedding-3-small');
    expect(localStorage.getItem('embeddingModelProviderId')).toBe('openai');
  });

  it('handles full end-to-end config load successfully', async () => {
    mockFetchSuccess();

    const { result } = renderHook(() => useChatConfig());

    await waitFor(() => expect(result.current.isConfigReady).toBe(true));

    expect(result.current.chatModelProvider).toEqual({
      key: 'gpt-4',
      providerId: 'openai',
    });
    expect(result.current.embeddingModelProvider).toEqual({
      key: 'text-embedding-3-small',
      providerId: 'openai',
    });
    expect(result.current.isConfigReady).toBe(true);
    expect(result.current.hasError).toBe(false);
  });

  it('calls fetch with correct URL and headers', async () => {
    mockFetchSuccess();

    renderHook(() => useChatConfig());

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/providers', {
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('sets hasError when fetch returns non-OK status', async () => {
    mockFetchError(503);

    const { result } = renderHook(() => useChatConfig());

    await waitFor(() => expect(result.current.hasError).toBe(true));

    expect(result.current.isConfigReady).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(
      'Provider fetching failed with status code 503',
    );
  });

  it('sets hasError when fetch throws a network error', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('Network error');
    });

    const { result } = renderHook(() => useChatConfig());

    await waitFor(() => expect(result.current.hasError).toBe(true));

    expect(result.current.isConfigReady).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Network error');
  });

  it('sets hasError when providers array is empty', async () => {
    mockFetchSuccess([]);

    const { result } = renderHook(() => useChatConfig());

    await waitFor(() => expect(result.current.hasError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith(
      'No chat model providers found, please configure them in the settings page.',
    );
  });

  it('sets hasError when no chat model provider can be found', async () => {
    // Provider with no chatModels
    mockFetchSuccess([
      {
        id: 'embed-only',
        name: 'EmbedOnly',
        chatModels: [],
        embeddingModels: [{ name: 'embed', key: 'embed-key' }],
      },
    ]);

    const { result } = renderHook(() => useChatConfig());

    await waitFor(() => expect(result.current.hasError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith(
      'No chat models found, pleae configure them in the settings page.',
    );
  });

  it('sets hasError when no embedding model provider can be found', async () => {
    // Provider with no embeddingModels
    mockFetchSuccess([
      {
        id: 'chat-only',
        name: 'ChatOnly',
        chatModels: [{ name: 'chat', key: 'chat-key' }],
        embeddingModels: [],
      },
    ]);

    const { result } = renderHook(() => useChatConfig());

    await waitFor(() => expect(result.current.hasError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith(
      'No embedding models found, pleae configure them in the settings page.',
    );
  });

  it('falls back to config.json preferences when localStorage is empty', async () => {
    // No localStorage values set — config.json provides the fallback
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/api/config') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            values: {
              preferences: {
                chatModelKey: 'gpt-3.5-turbo',
                chatModelProviderId: 'openai',
                embeddingModelKey: 'nomic-embed-text',
                embeddingModelProviderId: 'ollama',
              },
            },
          }),
        });
      }
      if (url === '/api/providers') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ providers: mockProviders() }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    });

    const { result } = renderHook(() => useChatConfig());

    await waitFor(() => expect(result.current.isConfigReady).toBe(true));

    // Should use config.json preferences, not just the first available model
    expect(result.current.chatModelProvider).toEqual({
      key: 'gpt-3.5-turbo',
      providerId: 'openai',
    });
    expect(result.current.embeddingModelProvider).toEqual({
      key: 'nomic-embed-text',
      providerId: 'ollama',
    });
  });

  it('does not fetch /api/config when localStorage has all values', async () => {
    localStorage.setItem('chatModelKey', 'gpt-4');
    localStorage.setItem('chatModelProviderId', 'openai');
    localStorage.setItem('embeddingModelKey', 'nomic-embed-text');
    localStorage.setItem('embeddingModelProviderId', 'ollama');

    let configFetchCalled = false;
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/api/config') {
        configFetchCalled = true;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ values: { preferences: {} } }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ providers: mockProviders() }),
      });
    });

    const { result } = renderHook(() => useChatConfig());
    await waitFor(() => expect(result.current.isConfigReady).toBe(true));

    expect(configFetchCalled).toBe(false);
  });
});
