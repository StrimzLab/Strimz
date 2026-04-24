import config from '@strimz/eslint-config/node'

export default [
  ...config,
  {
    ignores: ['generated/**', 'prisma/migrations/**'],
  },
]
