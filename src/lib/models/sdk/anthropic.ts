import { createAnthropic } from '@ai-sdk/anthropic';
import SdkLLM from './llm';
import SdkEmbedding from './embedding';
import BaseLLM from '../base/llm';
import BaseEmbedding from '../base/embedding';

interface AnthropicConfig {
  apiKey: string;
}

export function createChatModel(
  config: AnthropicConfig,
  modelName: string,
): BaseLLM<any> {
  const provider = createAnthropic({ apiKey: config.apiKey });
  return new SdkLLM({ model: provider(modelName) });
}

export function createEmbeddingModel(
  _config: AnthropicConfig,
  _modelName: string,
): BaseEmbedding<any> {
  throw new Error('Anthropic provider does not support embedding models.');
}
