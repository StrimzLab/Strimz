// @ts-check
import nodeConfig from './node.js'
import tseslint from 'typescript-eslint'

/**
 * Strimz ESLint config for NestJS apps.
 * Relaxes a few rules that conflict with NestJS DI and decorator patterns.
 */
export default tseslint.config(
  ...nodeConfig,
  {
    rules: {
      // NestJS decorators read constructor parameter types via reflect-metadata
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      // Service constructors with private/public/protected are deliberate DI declarations
      '@typescript-eslint/parameter-properties': 'off',
      '@typescript-eslint/no-extraneous-class': 'off',
      // DTO classes are pure data shapes; don't require explicit member accessibility
      '@typescript-eslint/explicit-member-accessibility': 'off',
    },
  },
)
