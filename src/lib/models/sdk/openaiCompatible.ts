import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

import SdkLLM from './llm';
import SdkEmbedding from './embedding';

import type BaseLLM from '../base/llm';
import type BaseEmbedding from '../base/embedding';

interface OpenAICompatibleConfig {
  baseURL: string;
  apiKey?: string;
  name?: string;
}

export function createChatModel(
  config: OpenAICompatibleConfig,
  modelName: string,
): BaseLLM<any> {
  const provider = createOpenAICompatible({
    name: config.name ?? 'openai-compatible',
    baseURL: config.baseURL,
    apiKey: config.apiKey,
  });
  return new SdkLLM({ model: provider(modelName) });
}

export function createEmbeddingModel(
  config: OpenAICompatibleConfig,
  modelName: string,
): BaseEmbedding<any> {
  const provider = createOpenAICompatible({
    name: config.name ?? 'openai-compatible',
    baseURL: config.baseURL,
    apiKey: config.apiKey,
  });
  return new SdkEmbedding({ model: provider.embeddingModel(modelName) });
}
