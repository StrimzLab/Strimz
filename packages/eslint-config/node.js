// @ts-check
import globals from 'globals'
import baseConfig from './base.js'
import tseslint from 'typescript-eslint'

/**
 * Strimz ESLint config for Node 22 services.
 */
export default tseslint.config(
  ...baseConfig,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      'no-process-exit': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
    },
  },
)
