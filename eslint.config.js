import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'dev-dist/**', 'node_modules/**', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/sim/**/*.js'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-globals': ['error', 'Date', 'window', 'document', 'performance', 'navigator', 'fetch', 'setTimeout', 'setInterval'],
      'no-restricted-properties': ['error', { object: 'Math', property: 'random', message: 'Use sim/rng.js' }],
    },
  },
];
