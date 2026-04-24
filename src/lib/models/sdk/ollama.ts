import { createOllama } from 'ollama-ai-provider-v2';
import SdkLLM from './llm';
import SdkEmbedding from './embedding';
import BaseLLM from '../base/llm';
import BaseEmbedding from '../base/embedding';

interface OllamaConfig {
  baseURL: string;
}

export function createChatModel(
  config: OllamaConfig,
  modelName: string,
): BaseLLM<any> {
  const provider = createOllama({ baseURL: config.baseURL });
  return new SdkLLM({ model: provider(modelName) });
}

export function createEmbeddingModel(
  config: OllamaConfig,
  modelName: string,
): BaseEmbedding<any> {
  const provider = createOllama({ baseURL: config.baseURL });
  return new SdkEmbedding({ model: provider.embedding(modelName) });
}
