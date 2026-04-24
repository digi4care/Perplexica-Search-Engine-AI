import { describe, it, expect } from 'vitest';
import { getSdkFactory, hasSdkFactory } from '../sdkRegistry';
import SdkLLM from '../llm';
import SdkEmbedding from '../embedding';

describe('SDK Provider Registry', () => {
  it('has factory for all supported provider types', () => {
    const supported = ['openai', 'anthropic', 'gemini', 'groq', 'ollama', 'lmstudio', 'lemonade'];

    for (const type of supported) {
      expect(hasSdkFactory(type), `Expected factory for ${type}`).toBe(true);
    }
  });

  it('returns undefined for unsupported provider types', () => {
    expect(getSdkFactory('transformers')).toBeUndefined();
    expect(getSdkFactory('nonexistent')).toBeUndefined();
    expect(getSdkFactory('')).toBeUndefined();
  });

  it('hasSdkFactory returns false for unsupported types', () => {
    expect(hasSdkFactory('transformers')).toBe(false);
    expect(hasSdkFactory('nonexistent')).toBe(false);
  });

  it('lmstudio and lemonade use the same factory (openaiCompatible)', () => {
    const lmstudio = getSdkFactory('lmstudio');
    const lemonade = getSdkFactory('lemonade');

    expect(lmstudio).toBeDefined();
    expect(lemonade).toBeDefined();
    expect(lmstudio).toBe(lemonade);
  });
});

describe('SDK Factory Functions', () => {
  describe('OpenAI', () => {
    it('createChatModel returns SdkLLM instance', () => {
      const factory = getSdkFactory('openai')!;
      const model = factory.createChatModel(
        { apiKey: 'test-key', baseURL: 'https://api.openai.com/v1' },
        'gpt-4o',
      );
      expect(model).toBeInstanceOf(SdkLLM);
    });

    it('createEmbeddingModel returns SdkEmbedding instance', () => {
      const factory = getSdkFactory('openai')!;
      const model = factory.createEmbeddingModel(
        { apiKey: 'test-key', baseURL: 'https://api.openai.com/v1' },
        'text-embedding-3-small',
      );
      expect(model).toBeInstanceOf(SdkEmbedding);
    });
  });

  describe('Anthropic', () => {
    it('createChatModel returns SdkLLM instance', () => {
      const factory = getSdkFactory('anthropic')!;
      const model = factory.createChatModel(
        { apiKey: 'test-key' },
        'claude-sonnet-4-20250514',
      );
      expect(model).toBeInstanceOf(SdkLLM);
    });

    it('createEmbeddingModel throws (not supported)', () => {
      const factory = getSdkFactory('anthropic')!;
      expect(() =>
        factory.createEmbeddingModel({ apiKey: 'test-key' }, 'unused'),
      ).toThrow('does not support embedding');
    });
  });

  describe('Gemini', () => {
    it('createChatModel returns SdkLLM instance', () => {
      const factory = getSdkFactory('gemini')!;
      const model = factory.createChatModel(
        { apiKey: 'test-key' },
        'gemini-2.5-pro',
      );
      expect(model).toBeInstanceOf(SdkLLM);
    });

    it('createEmbeddingModel returns SdkEmbedding instance', () => {
      const factory = getSdkFactory('gemini')!;
      const model = factory.createEmbeddingModel(
        { apiKey: 'test-key' },
        'text-embedding-004',
      );
      expect(model).toBeInstanceOf(SdkEmbedding);
    });
  });

  describe('Groq', () => {
    it('createChatModel returns SdkLLM instance', () => {
      const factory = getSdkFactory('groq')!;
      const model = factory.createChatModel(
        { apiKey: 'test-key' },
        'llama-3.3-70b-versatile',
      );
      expect(model).toBeInstanceOf(SdkLLM);
    });

    it('createEmbeddingModel throws (not supported)', () => {
      const factory = getSdkFactory('groq')!;
      expect(() =>
        factory.createEmbeddingModel({ apiKey: 'test-key' }, 'unused'),
      ).toThrow('does not support embedding');
    });
  });

  describe('Ollama', () => {
    it('createChatModel returns SdkLLM instance', () => {
      const factory = getSdkFactory('ollama')!;
      const model = factory.createChatModel(
        { baseURL: 'http://localhost:11434' },
        'llama3.2',
      );
      expect(model).toBeInstanceOf(SdkLLM);
    });

    it('createEmbeddingModel returns SdkEmbedding instance', () => {
      const factory = getSdkFactory('ollama')!;
      const model = factory.createEmbeddingModel(
        { baseURL: 'http://localhost:11434' },
        'nomic-embed-text',
      );
      expect(model).toBeInstanceOf(SdkEmbedding);
    });
  });

  describe('LM Studio (openai-compatible)', () => {
    it('createChatModel returns SdkLLM instance', () => {
      const factory = getSdkFactory('lmstudio')!;
      const model = factory.createChatModel(
        { baseURL: 'http://localhost:1234/v1' },
        'my-model',
      );
      expect(model).toBeInstanceOf(SdkLLM);
    });

    it('createEmbeddingModel returns SdkEmbedding instance', () => {
      const factory = getSdkFactory('lmstudio')!;
      const model = factory.createEmbeddingModel(
        { baseURL: 'http://localhost:1234/v1' },
        'my-embedding-model',
      );
      expect(model).toBeInstanceOf(SdkEmbedding);
    });
  });

  describe('Lemonade (openai-compatible)', () => {
    it('createChatModel returns SdkLLM instance', () => {
      const factory = getSdkFactory('lemonade')!;
      const model = factory.createChatModel(
        { baseURL: 'http://localhost:8000/v1' },
        'my-model',
      );
      expect(model).toBeInstanceOf(SdkLLM);
    });
  });
});
