import { createGroq } from '@ai-sdk/groq';
import SdkLLM from './llm';
import SdkEmbedding from './embedding';
import BaseLLM from '../base/llm';
import BaseEmbedding from '../base/embedding';

interface GroqConfig {
  apiKey: string;
}

export function createChatModel(config: GroqConfig, modelName: string): BaseLLM<any> {
  const provider = createGroq({ apiKey: config.apiKey });
  return new SdkLLM({ model: provider(modelName) });
}

export function createEmbeddingModel(_config: GroqConfig, _modelName: string): BaseEmbedding<any> {
  throw new Error('Groq provider does not support embedding models.');
}
