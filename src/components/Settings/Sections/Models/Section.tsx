import React, { useState } from 'react';
import { Zap, Server } from 'lucide-react';
import AddProvider from './AddProviderDialog';
import {
  ConfigModelProvider,
  ModelProviderUISection,
  UIConfigField,
} from '@/lib/config/types';
import ModelProvider from './ModelProvider';
import ModelSelect from './ModelSelect';

const Models = ({
  fields,
  values,
}: {
  fields: ModelProviderUISection[];
  values: ConfigModelProvider[];
}) => {
  const [providers, setProviders] = useState<ConfigModelProvider[]>(values);

  return (
    <div className="flex-1 space-y-6 overflow-y-auto py-6">
      {/* Active Models Section */}
      <div className="mx-6 rounded-xl bg-sky-500/5 dark:bg-sky-500/5 p-4 lg:p-5">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-4 h-4 text-sky-500" />
          <h3 className="text-sm font-medium text-black/80 dark:text-white/80">
            Active Models
          </h3>
        </div>
        <p className="text-xs text-black/50 dark:text-white/50 mb-4 ml-6">
          Choose which AI models to use for your searches and conversations.
          These take effect immediately.
        </p>
        <div className="flex flex-col gap-y-4">
          <ModelSelect
            providers={values.filter((p) =>
              p.chatModels.some((m) => m.key != 'error'),
            )}
            type="chat"
          />
          <ModelSelect
            providers={values.filter((p) =>
              p.embeddingModels.some((m) => m.key != 'error'),
            )}
            type="embedding"
          />
        </div>
      </div>

      {/* Provider Connections Section */}
      <div className="flex flex-col gap-y-4 px-6 pt-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Server className="w-4 h-4 text-black/40 dark:text-white/40" />
            <h3 className="text-sm font-medium text-black/80 dark:text-white/80">
              Provider Connections
            </h3>
          </div>
          <p className="text-xs text-black/50 dark:text-white/50 ml-6">
            Manage your AI service connections. Add API keys, configure servers,
            and control which models are available.
          </p>
        </div>
        <div className="flex flex-row justify-end">
          <AddProvider modelProviders={fields} setProviders={setProviders} />
        </div>
        {providers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 rounded-lg border-2 border-dashed border-light-200 dark:border-dark-200 bg-light-secondary/10 dark:bg-dark-secondary/10">
            <div className="p-3 rounded-full bg-sky-500/10 dark:bg-sky-500/10 mb-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-8 h-8 text-sky-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-black/70 dark:text-white/70 mb-1">
              No connections yet
            </p>
            <p className="text-xs text-black/50 dark:text-white/50 text-center max-w-sm mb-4">
              Add your first connection to start using AI models. Connect to
              OpenAI, Anthropic, Ollama, and more.
            </p>
          </div>
        ) : (
          providers.map((provider) => (
            <ModelProvider
              key={`provider-${provider.id}`}
              fields={
                (fields.find((f) => f.key === provider.type)?.fields ??
                  []) as UIConfigField[]
              }
              modelProvider={provider}
              setProviders={setProviders}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default Models;