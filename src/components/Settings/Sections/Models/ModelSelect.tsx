import Select from '@/components/ui/Select';
import { ConfigModelProvider } from '@/lib/config/types';
import { useChat } from '@/lib/hooks/useChat';
import { useState } from 'react';
import { toast } from 'sonner';

const ModelSelect = ({
  providers,
  type,
}: {
  providers: ConfigModelProvider[];
  type: 'chat' | 'embedding';
}) => {
  const [selectedModel, setSelectedModel] = useState<string>(
    type === 'chat'
      ? `${localStorage.getItem('chatModelProviderId')}/${localStorage.getItem('chatModelKey')}`
      : `${localStorage.getItem('embeddingModelProviderId')}/${localStorage.getItem('embeddingModelKey')}`,
  );
  const [loading, setLoading] = useState(false);
  const { setChatModelProvider, setEmbeddingModelProvider } = useChat();

  const handleSave = async (newValue: string) => {
    setLoading(true);
    setSelectedModel(newValue);

    try {
      if (type === 'chat') {
        const providerId = newValue.split('/')[0];
        const modelKey = newValue.split('/').slice(1).join('/');

        localStorage.setItem('chatModelProviderId', providerId);
        localStorage.setItem('chatModelKey', modelKey);

        setChatModelProvider({
          providerId: providerId,
          key: modelKey,
        });

        // Persist to config.json as backup (fire-and-forget)
        fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'preferences.chatModelProviderId', value: providerId }),
        });
        fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'preferences.chatModelKey', value: modelKey }),
        });
      } else {
        const providerId = newValue.split('/')[0];
        const modelKey = newValue.split('/').slice(1).join('/');

        localStorage.setItem('embeddingModelProviderId', providerId);
        localStorage.setItem('embeddingModelKey', modelKey);

        setEmbeddingModelProvider({
          providerId: providerId,
          key: modelKey,
        });

        // Persist to config.json as backup (fire-and-forget)
        fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'preferences.embeddingModelProviderId', value: providerId }),
        });
        fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'preferences.embeddingModelKey', value: modelKey }),
        });
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Failed to save configuration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-xl border border-light-200 bg-light-primary/80 p-4 lg:p-6 transition-colors dark:border-dark-200 dark:bg-dark-primary/80">
      <div className="space-y-3 lg:space-y-5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-sky-500" />
          <h4 className="text-sm lg:text-sm text-black dark:text-white">
            {type === 'chat' ? 'Active Chat Model' : 'Active Embedding Model'}
          </h4>
        </div>
        <p className="text-[11px] lg:text-xs text-black/50 dark:text-white/50">
          {type === 'chat'
            ? 'The model used for all your searches and conversations.'
            : 'Embeddings power search quality. Changing this may affect existing search results.'
        </p>
        <Select
          value={selectedModel}
          onChange={(event) => handleSave(event.target.value)}
          options={
            type === 'chat'
              ? providers.flatMap((provider) =>
                  provider.chatModels.map((model) => ({
                    value: `${provider.id}/${model.key}`,
                    label: `${provider.name} - ${model.name}`,
                  })),
                )
              : providers.flatMap((provider) =>
                  provider.embeddingModels.map((model) => ({
                    value: `${provider.id}/${model.key}`,
                    label: `${provider.name} - ${model.name}`,
                  })),
                )
          }
          className="!text-xs lg:!text-[13px]"
          loading={loading}
          disabled={loading}
        />
      </div>
    </section>
  );
};

export default ModelSelect;
