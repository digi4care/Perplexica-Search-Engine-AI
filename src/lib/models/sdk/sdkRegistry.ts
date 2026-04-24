import type BaseLLM from '../base/llm';
import type BaseEmbedding from '../base/embedding';
import * as openai from './openai';
import * as anthropic from './anthropic';
import * as gemini from './gemini';
import * as groq from './groq';
import * as ollama from './ollama';
import * as openaiCompatible from './openaiCompatible';

export interface SdkModelFactory {
  createChatModel: (config: any, modelName: string) => BaseLLM<any>;
  createEmbeddingModel: (config: any, modelName: string) => BaseEmbedding<any>;
}

const registry: Record<string, SdkModelFactory> = {
  openai,
  anthropic,
  gemini,
  groq,
  ollama,
  lmstudio: openaiCompatible,
  lemonade: openaiCompatible,
};

export function getSdkFactory(providerType: string): SdkModelFactory | undefined {
  return registry[providerType];
}

export function hasSdkFactory(providerType: string): boolean {
  return providerType in registry;
}
