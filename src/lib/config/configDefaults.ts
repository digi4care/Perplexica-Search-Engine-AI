import { Config, UIConfigSections } from './types';
import { CONFIG_VERSION } from './configMigration';

export const DEFAULT_CONFIG: Config = {
  version: CONFIG_VERSION,
  setupComplete: false,
  preferences: {},
  personalization: {},
  modelProviders: [],
  search: { searxngURL: '' },
};

export const DEFAULT_UI_CONFIG_SECTIONS: UIConfigSections = {
  preferences: [
    {
      name: 'Theme',
      key: 'theme',
      type: 'select',
      options: [
        { name: 'Light', value: 'light' },
        { name: 'Dark', value: 'dark' },
      ],
      required: false,
      description: 'Choose between light and dark layouts for the app.',
      default: 'dark',
      scope: 'client',
    },
    {
      name: 'Measurement Unit',
      key: 'measureUnit',
      type: 'select',
      options: [
        { name: 'Imperial', value: 'Imperial' },
        { name: 'Metric', value: 'Metric' },
      ],
      required: false,
      description: 'Choose between Metric  and Imperial measurement unit.',
      default: 'Metric',
      scope: 'client',
    },
    {
      name: 'Auto video & image search',
      key: 'autoMediaSearch',
      type: 'switch',
      required: false,
      description: 'Automatically search for relevant images and videos.',
      default: true,
      scope: 'client',
    },
    {
      name: 'Show weather widget',
      key: 'showWeatherWidget',
      type: 'switch',
      required: false,
      description: 'Display the weather card on the home screen.',
      default: true,
      scope: 'client',
    },
    {
      name: 'Show news widget',
      key: 'showNewsWidget',
      type: 'switch',
      required: false,
      description: 'Display the recent news card on the home screen.',
      default: true,
      scope: 'client',
    },
  ],
  personalization: [
    {
      name: 'System Instructions',
      key: 'systemInstructions',
      type: 'textarea',
      required: false,
      description: 'Add custom behavior or tone for the model.',
      placeholder:
        'e.g., "Respond in a friendly and concise tone" or "Use British English and format answers as bullet points."',
      scope: 'client',
    },
  ],
  modelProviders: [],
  search: [
    {
      name: 'SearXNG URL',
      key: 'searxngURL',
      type: 'string',
      required: false,
      description: 'The URL of your SearXNG instance',
      placeholder: 'http://localhost:4000',
      default: '',
      scope: 'server',
      env: 'SEARXNG_API_URL',
    },
  ],
};
