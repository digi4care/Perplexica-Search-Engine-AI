import nextConfig from 'eslint-config-next';

export default [
  ...nextConfig,
  {
    rules: {
      // Disable React-specific rules that conflict with Next.js app router
      'react/no-unknown-property': 'off',
    },
  },
];
