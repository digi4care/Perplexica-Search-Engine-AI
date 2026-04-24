import { createGoogleGenerativeAI } from '@ai-sdk/google';
import SdkLLM from './llm';
import SdkEmbedding from './embedding';
import BaseLLM from '../base/llm';
import BaseEmbedding from '../base/embedding';

interface GeminiConfig {
  apiKey: string;
}

export function createChatModel(config: GeminiConfig, modelName: string): BaseLLM<any> {
  const provider = createGoogleGenerativeAI({ apiKey: config.apiKey });
  return new SdkLLM({ model: provider(modelName) });
}

export function createEmbeddingModel(config: GeminiConfig, modelName: string): BaseEmbedding<any> {
  const provider = createGoogleGenerativeAI({ apiKey: config.apiKey });
  return new SdkEmbedding({ model: provider.embedding(modelName) });
}
