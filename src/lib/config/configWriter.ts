import fs from 'fs';
import { Config, ConfigModelProvider } from './types';
import { hashObj } from '../utils/hash';

export const saveConfig = (configPath: string, config: Config): void => {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
};

export const updateConfigValue = (config: Config, key: string, val: any): Config => {
  const parts = key.split('.');
  if (parts.length === 0) return config;
  const result = JSON.parse(JSON.stringify(config)) as Config;
  let target: any = result;
  for (let i = 0; i < parts.length - 1; i++) {
    if (target[parts[i]] === null || typeof target[parts[i]] !== 'object') {
      target[parts[i]] = {};
    }
    target = target[parts[i]];
  }
  target[parts[parts.length - 1]] = val;
  return result;
};

export const addModelProvider = (
  config: Config, type: string, name: string, providerConfig: any,
): { config: Config; provider: ConfigModelProvider } => {
  const provider: ConfigModelProvider = {
    id: crypto.randomUUID(), name, type, config: providerConfig,
    chatModels: [], embeddingModels: [], hash: hashObj(providerConfig),
  };
  return { config: { ...config, modelProviders: [...config.modelProviders, provider] }, provider };
};

export const removeModelProvider = (config: Config, id: string): Config => {
  if (!config.modelProviders.some((p) => p.id === id)) return config;
  return { ...config, modelProviders: config.modelProviders.filter((p) => p.id !== id) };
};

export const updateModelProvider = (
  config: Config, id: string, name: string, providerConfig: any,
): { config: Config; provider: ConfigModelProvider } => {
  const providers = [...config.modelProviders];
  const provider = providers.find((p) => p.id === id);
  if (!provider) throw new Error('Provider not found');
  provider.name = name;
  provider.config = providerConfig;
  return { config: { ...config, modelProviders: providers }, provider };
};

export const addProviderModel = (
  config: Config, providerId: string, type: 'embedding' | 'chat', model: any,
): { config: Config; model: any } => {
  const providers = [...config.modelProviders];
  const provider = providers.find((p) => p.id === providerId);
  if (!provider) throw new Error('Invalid provider id');
  delete model.type;
  if (type === 'chat') provider.chatModels = [...provider.chatModels, model];
  else provider.embeddingModels = [...provider.embeddingModels, model];
  return { config: { ...config, modelProviders: providers }, model };
};

export const removeProviderModel = (
  config: Config, providerId: string, type: 'embedding' | 'chat', modelKey: string,
): Config => {
  const providers = [...config.modelProviders];
  const provider = providers.find((p) => p.id === providerId);
  if (!provider) throw new Error('Invalid provider id');
  if (type === 'chat') provider.chatModels = provider.chatModels.filter((m) => m.key !== modelKey);
  else provider.embeddingModels = provider.embeddingModels.filter((m) => m.key != modelKey);
  return { ...config, modelProviders: providers };
};

export const markSetupComplete = (config: Config): Config => {
  if (!config.setupComplete) return { ...config, setupComplete: true };
  return config;
};
