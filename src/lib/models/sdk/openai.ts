import { createOpenAI } from '@ai-sdk/openai';
import SdkLLM from './llm';
import SdkEmbedding from './embedding';
import BaseLLM from '../base/llm';
import BaseEmbedding from '../base/embedding';

interface OpenAIConfig {
  apiKey: string;
  baseURL: string;
}

export function createChatModel(
  config: OpenAIConfig,
  modelName: string,
): BaseLLM<any> {
  const provider = createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });
  return new SdkLLM({ model: provider(modelName) });
}

export function createEmbeddingModel(
  config: OpenAIConfig,
  modelName: string,
): BaseEmbedding<any> {
  const provider = createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });
  return new SdkEmbedding({ model: provider.embedding(modelName) });
}
