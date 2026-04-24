import fs from 'fs';
import { Config, ConfigModelProvider, UIConfigSections } from './types';
import { hashObj } from '../utils/hash';
import { getModelProvidersUIConfigSection } from '../models/providers';
import { DEFAULT_CONFIG, DEFAULT_UI_CONFIG_SECTIONS } from './configDefaults';

export { DEFAULT_CONFIG, DEFAULT_UI_CONFIG_SECTIONS };

export const loadConfigFromDisk = (
  configPath: string,
  defaultConfig: Config,
): Config => {
  const exists = fs.existsSync(configPath);
  if (!exists) {
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.error(`Error parsing config file at ${configPath}:`, err);
      console.log('Loading default config and overwriting the existing file.');
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
      return defaultConfig;
    }
    console.log('Unknown error reading config file:', err);
    return defaultConfig;
  }
};

export const initializeFromEnv = (
  config: Config,
  uiConfigSections: UIConfigSections,
): { config: Config; uiConfigSections: UIConfigSections } => {
  const providerConfigSections = getModelProvidersUIConfigSection();
  const sections: UIConfigSections = {
    ...uiConfigSections,
    modelProviders: providerConfigSections,
  };
  const newProviders: ConfigModelProvider[] = [];
  providerConfigSections.forEach((provider) => {
    const np: ConfigModelProvider & { required?: string[] } = {
      id: crypto.randomUUID(),
      name: `${provider.name}`,
      type: provider.key,
      chatModels: [],
      embeddingModels: [],
      config: {},
      required: [],
      hash: '',
    };
    provider.fields.forEach((field) => {
      np.config[field.key] = process.env[field.env!] || field.default || '';
      if (field.required) np.required?.push(field.key);
    });
    let configured = true;
    np.required?.forEach((r) => {
      if (!np.config[r]) configured = false;
    });
    if (configured) {
      const hash = hashObj(np.config);
      np.hash = hash;
      delete np.required;
      const exists = config.modelProviders.find((p) => p.hash === hash);
      if (!exists) newProviders.push(np);
    }
  });
  const updatedSearch = { ...config.search };
  sections.search.forEach((f) => {
    if (f.env && !updatedSearch[f.key]) {
      updatedSearch[f.key] = process.env[f.env] ?? f.default ?? '';
    }
  });
  return { config: { ...config, modelProviders: [...config.modelProviders, ...newProviders], search: updatedSearch }, uiConfigSections: sections };
};

export const getConfigValue = (config: Config, key: string, defaultValue?: any): any => {
  const nested = key.split('.');
  let obj: any = config;
  for (let i = 0; i < nested.length; i++) {
    if (obj == null) return defaultValue;
    obj = obj[nested[i]];
  }
  return obj === undefined ? defaultValue : obj;
};

export const isSetupComplete = (config: Config): boolean => config.setupComplete;
export const getCurrentConfig = (config: Config): Config => JSON.parse(JSON.stringify(config));
export const getUIConfigSections = (sections: UIConfigSections): UIConfigSections => sections;
