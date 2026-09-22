import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

/**
 * ESLint flat configuration for EcoVault Lite.
 * Uses the recommended ruleset and disables rules that conflict with Prettier.
 */
export default [
  {
    ignores: [
      'node_modules/**',
      'coverage/**',
      'docs-gen/**',
      'data/**',
      'public/vendor/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
      'prefer-const': 'error',
      eqeqeq: ['error', 'smart'],
    },
  },
  {
    files: ['test/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  prettier,
];
