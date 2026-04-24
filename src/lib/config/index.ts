import path from 'node:path';
import { Config, UIConfigSections } from './types';
import { DEFAULT_CONFIG, DEFAULT_UI_CONFIG_SECTIONS, loadConfigFromDisk, initializeFromEnv, getConfigValue, isSetupComplete, getCurrentConfig, getUIConfigSections } from './configReader';
import { saveConfig, updateConfigValue, addModelProvider, removeModelProvider, updateModelProvider, addProviderModel, removeProviderModel, markSetupComplete } from './configWriter';
import { migrateConfig } from './configMigration';

class ConfigManager {
  configPath: string = path.join(process.env.DATA_DIR || process.cwd(), '/data/config.json');
  currentConfig: Config;
  uiConfigSections: UIConfigSections;

  constructor() {
    this.uiConfigSections = { ...DEFAULT_UI_CONFIG_SECTIONS, modelProviders: [] };
    this.currentConfig = loadConfigFromDisk(this.configPath, DEFAULT_CONFIG);
    this.currentConfig = migrateConfig(this.currentConfig);
    const env = initializeFromEnv(this.currentConfig, this.uiConfigSections);
    this.currentConfig = env.config;
    this.uiConfigSections = env.uiConfigSections;
    saveConfig(this.configPath, this.currentConfig);
  }

  private save() { saveConfig(this.configPath, this.currentConfig); }

  public getConfig(key: string, defaultValue?: any): any {
    return getConfigValue(this.currentConfig, key, defaultValue);
  }

  public updateConfig(key: string, val: any) {
    this.currentConfig = updateConfigValue(this.currentConfig, key, val);
    this.save();
  }

  public addModelProvider(type: string, name: string, config: any) {
    const r = addModelProvider(this.currentConfig, type, name, config);
    this.currentConfig = r.config; this.save(); return r.provider;
  }

  public removeModelProvider(id: string) {
    this.currentConfig = removeModelProvider(this.currentConfig, id); this.save();
  }

  public async updateModelProvider(id: string, name: string, config: any) {
    const r = updateModelProvider(this.currentConfig, id, name, config);
    this.currentConfig = r.config; this.save(); return r.provider;
  }

  public addProviderModel(providerId: string, type: 'embedding' | 'chat', model: any) {
    const r = addProviderModel(this.currentConfig, providerId, type, model);
    this.currentConfig = r.config; this.save(); return r.model;
  }

  public removeProviderModel(providerId: string, type: 'embedding' | 'chat', modelKey: string) {
    this.currentConfig = removeProviderModel(this.currentConfig, providerId, type, modelKey);
    this.save();
  }

  public isSetupComplete() { return isSetupComplete(this.currentConfig); }

  public markSetupComplete() {
    this.currentConfig = markSetupComplete(this.currentConfig); this.save();
  }

  public getUIConfigSections(): UIConfigSections { return getUIConfigSections(this.uiConfigSections); }
  public getCurrentConfig(): Config { return getCurrentConfig(this.currentConfig); }
}

const configManager = new ConfigManager();
export default configManager;
