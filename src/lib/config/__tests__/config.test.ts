import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Config, UIConfigSections, ConfigModelProvider } from '../types';
import type { Model } from '../../models/types';

// --- Mocks ---
const mockHashObj = vi.fn((obj: Record<string, unknown>) => 'testhash');

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
}));

vi.mock('@/lib/models/providers', () => ({
  getModelProvidersUIConfigSection: vi.fn(),
}));

vi.mock('node:path', () => ({
  default: { join: vi.fn((...args: string[]) => args.join('/')) },
}));

vi.mock('@/lib/utils/hash', () => ({
  hashObj: (...args: unknown[]) => mockHashObj(...(args as [Record<string, unknown>])),
}));

// Must import after vi.mock setup
import fs from 'fs';
import { getModelProvidersUIConfigSection } from '@/lib/models/providers';
import {
  loadConfigFromDisk,
  initializeFromEnv,
  getConfigValue,
  isSetupComplete,
  getCurrentConfig,
  DEFAULT_CONFIG,
  DEFAULT_UI_CONFIG_SECTIONS,
} from '../configReader';
import {
  saveConfig,
  updateConfigValue,
  addModelProvider,
  removeModelProvider,
  updateModelProvider,
  addProviderModel,
  removeProviderModel,
  markSetupComplete,
} from '../configWriter';
import { migrateConfig, CONFIG_VERSION } from '../configMigration';

// --- Helpers ---
const makeConfig = (overrides: Partial<Config> = {}): Config => ({
  version: 1,
  setupComplete: false,
  preferences: {},
  personalization: {},
  modelProviders: [],
  search: { searxngURL: '' },
  ...overrides,
});

const makeProvider = (overrides: Partial<ConfigModelProvider> = {}): ConfigModelProvider => ({
  id: 'p1',
  name: 'Test Provider',
  type: 'openai',
  chatModels: [],
  embeddingModels: [],
  config: {},
  hash: 'h1',
  ...overrides,
});

// =============================================
// configReader
// =============================================
describe('configReader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('crypto', { randomUUID: vi.fn().mockReturnValue('test-uuid') });
    mockHashObj.mockReturnValue('testhash');
  });

  // --- loadConfigFromDisk ---
  describe('loadConfigFromDisk', () => {
    it('creates file and returns default when file is missing', () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
      const defaults = makeConfig();
      const result = loadConfigFromDisk('/tmp/cfg.json', defaults);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/tmp/cfg.json',
        JSON.stringify(defaults, null, 2),
      );
      expect(result).toBe(defaults);
    });

    it('parses existing config file', () => {
      const stored = makeConfig({ setupComplete: true });
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify(stored),
      );
      const result = loadConfigFromDisk('/tmp/cfg.json', makeConfig());
      expect(result.setupComplete).toBe(true);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('returns default and overwrites file on SyntaxError', () => {
      const defaults = makeConfig();
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new SyntaxError('bad json');
      });
      const result = loadConfigFromDisk('/tmp/cfg.json', defaults);
      expect(result).toBe(defaults);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/tmp/cfg.json',
        JSON.stringify(defaults, null, 2),
      );
    });

    it('returns default on unknown error without overwriting', () => {
      const defaults = makeConfig();
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('disk failure');
      });
      const result = loadConfigFromDisk('/tmp/cfg.json', defaults);
      expect(result).toBe(defaults);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });
  });

  // --- initializeFromEnv ---
  describe('initializeFromEnv', () => {
    it('creates providers from env vars', () => {
      const originalEnv = process.env;
      process.env = { ...originalEnv, OPENAI_API_KEY: 'sk-test' };

      (getModelProvidersUIConfigSection as ReturnType<typeof vi.fn>).mockReturnValue([
        {
          name: 'OpenAI',
          key: 'openai',
          fields: [
            { key: 'apiKey', env: 'OPENAI_API_KEY', required: true },
          ],
        },
      ]);

      const cfg = makeConfig();
      const sections: UIConfigSections = {
        preferences: [],
        personalization: [],
        modelProviders: [],
        search: [],
      };

      const result = initializeFromEnv(cfg, sections);
      expect(result.config.modelProviders).toHaveLength(1);
      expect(result.config.modelProviders[0].id).toBe('test-uuid');
      expect(result.config.modelProviders[0].config.apiKey).toBe('sk-test');
      expect(result.uiConfigSections.modelProviders).toHaveLength(1);

      process.env = originalEnv;
    });

    it('skips providers with missing required fields', () => {
      const originalEnv = process.env;
      process.env = { ...originalEnv };
      delete process.env.OPENAI_API_KEY;

      (getModelProvidersUIConfigSection as ReturnType<typeof vi.fn>).mockReturnValue([
        {
          name: 'OpenAI',
          key: 'openai',
          fields: [
            { key: 'apiKey', env: 'OPENAI_API_KEY', required: true },
          ],
        },
      ]);

      const cfg = makeConfig();
      const sections: UIConfigSections = {
        preferences: [],
        personalization: [],
        modelProviders: [],
        search: [],
      };

      const result = initializeFromEnv(cfg, sections);
      expect(result.config.modelProviders).toHaveLength(0);

      process.env = originalEnv;
    });

    it('skips provider if hash already exists in config', () => {
      const originalEnv = process.env;
      process.env = { ...originalEnv, OPENAI_API_KEY: 'sk-test' };

      (getModelProvidersUIConfigSection as ReturnType<typeof vi.fn>).mockReturnValue([
        {
          name: 'OpenAI',
          key: 'openai',
          fields: [
            { key: 'apiKey', env: 'OPENAI_API_KEY', required: true },
          ],
        },
      ]);

      const existingProvider = makeProvider({
        id: 'old-uuid',
        name: 'OpenAI',
        type: 'openai',
        config: { apiKey: 'sk-test' },
        hash: 'testhash',
      });
      const cfg = makeConfig({ modelProviders: [existingProvider] });
      const sections: UIConfigSections = {
        preferences: [],
        personalization: [],
        modelProviders: [],
        search: [],
      };

      const result = initializeFromEnv(cfg, sections);
      expect(result.config.modelProviders).toHaveLength(1);
      expect(result.config.modelProviders[0].id).toBe('old-uuid');

      process.env = originalEnv;
    });

    it('reads search config from env', () => {
      const originalEnv = process.env;
      process.env = { ...originalEnv, SEARXNG_API_URL: 'http://localhost:4000' };

      (getModelProvidersUIConfigSection as ReturnType<typeof vi.fn>).mockReturnValue([]);

      const cfg = makeConfig({ search: { searxngURL: '' } });
      const sections: UIConfigSections = {
        preferences: [],
        personalization: [],
        modelProviders: [],
        search: [
          { key: 'searxngURL', env: 'SEARXNG_API_URL', name: 'SearXNG URL', type: 'string', required: false, description: '', scope: 'server' },
        ],
      };

      const result = initializeFromEnv(cfg, sections);
      expect(result.config.search.searxngURL).toBe('http://localhost:4000');

      process.env = originalEnv;
    });

    it('does not overwrite existing search value from env', () => {
      const originalEnv = process.env;
      process.env = { ...originalEnv, SEARXNG_API_URL: 'http://new:4000' };

      (getModelProvidersUIConfigSection as ReturnType<typeof vi.fn>).mockReturnValue([]);

      const cfg = makeConfig({ search: { searxngURL: 'http://existing:4000' } });
      const sections: UIConfigSections = {
        preferences: [],
        personalization: [],
        modelProviders: [],
        search: [
          { key: 'searxngURL', env: 'SEARXNG_API_URL', name: 'SearXNG URL', type: 'string', required: false, description: '', scope: 'server' },
        ],
      };

      const result = initializeFromEnv(cfg, sections);
      expect(result.config.search.searxngURL).toBe('http://existing:4000');

      process.env = originalEnv;
    });
  });

  // --- getConfigValue ---
  describe('getConfigValue', () => {
    it('gets top-level value', () => {
      const cfg = makeConfig();
      expect(getConfigValue(cfg, 'version')).toBe(1);
    });

    it('gets nested value via dot notation', () => {
      const cfg = makeConfig({ search: { searxngURL: 'http://test' } });
      expect(getConfigValue(cfg, 'search.searxngURL')).toBe('http://test');
    });

    it('returns defaultValue for missing keys', () => {
      const cfg = makeConfig();
      expect(getConfigValue(cfg, 'nonexistent', 'fallback')).toBe('fallback');
    });

    it('returns defaultValue for nested missing path', () => {
      const cfg = makeConfig();
      expect(getConfigValue(cfg, 'search.deep.nested', 'def')).toBe('def');
    });

    it('returns undefined when no defaultValue and key missing', () => {
      const cfg = makeConfig();
      expect(getConfigValue(cfg, 'nonexistent')).toBeUndefined();
    });
  });

  // --- isSetupComplete ---
  describe('isSetupComplete', () => {
    it('returns true when setupComplete is true', () => {
      expect(isSetupComplete(makeConfig({ setupComplete: true }))).toBe(true);
    });

    it('returns false when setupComplete is false', () => {
      expect(isSetupComplete(makeConfig({ setupComplete: false }))).toBe(false);
    });
  });

  // --- getCurrentConfig ---
  describe('getCurrentConfig', () => {
    it('returns a deep clone', () => {
      const cfg = makeConfig({ search: { searxngURL: 'http://orig' } });
      const clone = getCurrentConfig(cfg);
      clone.search.searxngURL = 'http://modified';
      expect(cfg.search.searxngURL).toBe('http://orig');
    });
  });

  // --- DEFAULT_CONFIG ---
  describe('DEFAULT_CONFIG', () => {
    it('has correct structure', () => {
      expect(DEFAULT_CONFIG.version).toBe(1);
      expect(DEFAULT_CONFIG.setupComplete).toBe(false);
      expect(DEFAULT_CONFIG.preferences).toEqual({});
      expect(DEFAULT_CONFIG.personalization).toEqual({});
      expect(DEFAULT_CONFIG.modelProviders).toEqual([]);
      expect(DEFAULT_CONFIG.search).toEqual({ searxngURL: '' });
    });
  });
});

// =============================================
// configWriter
// =============================================
describe('configWriter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('crypto', { randomUUID: vi.fn().mockReturnValue('test-uuid') });
    mockHashObj.mockReturnValue('testhash');
  });

  // --- saveConfig ---
  describe('saveConfig', () => {
    it('writes JSON to file', () => {
      const cfg = makeConfig();
      saveConfig('/tmp/cfg.json', cfg);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/tmp/cfg.json',
        JSON.stringify(cfg, null, 2),
      );
    });
  });

  // --- updateConfigValue ---
  describe('updateConfigValue', () => {
    it('sets a top-level value', () => {
      const cfg = makeConfig();
      const result = updateConfigValue(cfg, 'setupComplete', true);
      expect(result.setupComplete).toBe(true);
    });

    it('sets a nested value via dot notation', () => {
      const cfg = makeConfig();
      const result = updateConfigValue(cfg, 'search.searxngURL', 'http://new');
      expect(result.search.searxngURL).toBe('http://new');
    });

    it('creates intermediate objects if missing', () => {
      const cfg = makeConfig();
      const result = updateConfigValue(cfg, 'search.deep.nested', 'val');
      expect((result.search as Record<string, unknown>).deep).toEqual({ nested: 'val' });
    });

    it('does not mutate original config', () => {
      const cfg = makeConfig();
      updateConfigValue(cfg, 'search.searxngURL', 'http://changed');
      expect(cfg.search.searxngURL).toBe('');
    });
  });

  // --- addModelProvider ---
  describe('addModelProvider', () => {
    it('adds provider with hash and returns it', () => {
      const cfg = makeConfig();
      const providerConfig = { apiKey: 'sk-abc' };
      const result = addModelProvider(cfg, 'openai', 'My OpenAI', providerConfig);

      expect(result.config.modelProviders).toHaveLength(1);
      expect(result.provider.id).toBe('test-uuid');
      expect(result.provider.name).toBe('My OpenAI');
      expect(result.provider.type).toBe('openai');
      expect(result.provider.hash).toBe('testhash');
      expect(result.provider.chatModels).toEqual([]);
      expect(result.provider.embeddingModels).toEqual([]);
    });
  });

  // --- removeModelProvider ---
  describe('removeModelProvider', () => {
    it('removes provider by id', () => {
      const provider = makeProvider({ id: 'p1' });
      const cfg = makeConfig({ modelProviders: [provider] });
      const result = removeModelProvider(cfg, 'p1');
      expect(result.modelProviders).toHaveLength(0);
    });

    it('is no-op if provider not found', () => {
      const provider = makeProvider({ id: 'p1' });
      const cfg = makeConfig({ modelProviders: [provider] });
      const result = removeModelProvider(cfg, 'nonexistent');
      expect(result.modelProviders).toHaveLength(1);
    });
  });

  // --- updateModelProvider ---
  describe('updateModelProvider', () => {
    it('updates provider name and config', () => {
      const provider = makeProvider({ id: 'p1', name: 'Old', config: { old: true } });
      const cfg = makeConfig({ modelProviders: [provider] });
      const result = updateModelProvider(cfg, 'p1', 'New', { new: true });
      expect(result.provider.name).toBe('New');
      expect(result.provider.config).toEqual({ new: true });
    });

    it('throws if provider not found', () => {
      const cfg = makeConfig();
      expect(() => updateModelProvider(cfg, 'missing', 'X', {})).toThrow(
        'Provider not found',
      );
    });
  });

  // --- addProviderModel ---
  describe('addProviderModel', () => {
    it('adds chat model', () => {
      const provider = makeProvider({ id: 'p1' });
      const cfg = makeConfig({ modelProviders: [provider] });
      const model = { key: 'gpt-4', type: 'chat', name: 'GPT-4' };
      const result = addProviderModel(cfg, 'p1', 'chat', { ...model });
      expect(result.config.modelProviders[0].chatModels).toHaveLength(1);
      expect((result.config.modelProviders[0].chatModels[0] as Record<string, unknown>).type).toBeUndefined();
      expect((result.config.modelProviders[0].chatModels[0] as Record<string, unknown>).key).toBe('gpt-4');
    });

    it('adds embedding model', () => {
      const provider = makeProvider({ id: 'p1' });
      const cfg = makeConfig({ modelProviders: [provider] });
      const model = { key: 'text-emb', type: 'embedding', name: 'Embedding' };
      const result = addProviderModel(cfg, 'p1', 'embedding', { ...model });
      expect(result.config.modelProviders[0].embeddingModels).toHaveLength(1);
      expect((result.config.modelProviders[0].embeddingModels[0] as Record<string, unknown>).type).toBeUndefined();
    });

    it('throws for invalid provider id', () => {
      const cfg = makeConfig();
      expect(() => addProviderModel(cfg, 'missing', 'chat', {})).toThrow(
        'Invalid provider id',
      );
    });
  });

  // --- removeProviderModel ---
  describe('removeProviderModel', () => {
    it('removes chat model by key', () => {
      const provider = makeProvider({
        id: 'p1',
        chatModels: [{ key: 'gpt-4', name: 'GPT-4' }] as Model[],
        embeddingModels: [{ key: 'text-emb', name: 'Embedding' }] as Model[],
      });
      const cfg = makeConfig({ modelProviders: [provider] });
      const result = removeProviderModel(cfg, 'p1', 'chat', 'gpt-4');
      expect(result.modelProviders[0].chatModels).toHaveLength(0);
      expect(result.modelProviders[0].embeddingModels).toHaveLength(1);
    });

    it('removes embedding model by key', () => {
      const provider = makeProvider({
        id: 'p1',
        chatModels: [{ key: 'gpt-4', name: 'GPT-4' }] as Model[],
        embeddingModels: [{ key: 'text-emb', name: 'Embedding' }] as Model[],
      });
      const cfg = makeConfig({ modelProviders: [provider] });
      const result = removeProviderModel(cfg, 'p1', 'embedding', 'text-emb');
      expect(result.modelProviders[0].embeddingModels).toHaveLength(0);
      expect(result.modelProviders[0].chatModels).toHaveLength(1);
    });

    it('throws for invalid provider id', () => {
      const cfg = makeConfig();
      expect(() => removeProviderModel(cfg, 'missing', 'chat', 'x')).toThrow(
        'Invalid provider id',
      );
    });
  });

  // --- markSetupComplete ---
  describe('markSetupComplete', () => {
    it('sets setupComplete to true', () => {
      const cfg = makeConfig({ setupComplete: false });
      const result = markSetupComplete(cfg);
      expect(result.setupComplete).toBe(true);
    });

    it('returns same config if already complete', () => {
      const cfg = makeConfig({ setupComplete: true });
      const result = markSetupComplete(cfg);
      expect(result).toBe(cfg);
    });
  });
});

// =============================================
// configMigration
// =============================================
describe('configMigration', () => {
  it('CONFIG_VERSION is 1', () => {
    expect(CONFIG_VERSION).toBe(1);
  });

  it('migrateConfig returns config unchanged', () => {
    const cfg = makeConfig({ setupComplete: true });
    const result = migrateConfig(cfg);
    expect(result).toBe(cfg);
  });
});
