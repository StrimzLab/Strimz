# @strimz/eslint-config

Shared ESLint flat configurations for every package and app in the Strimz monorepo. Built for ESLint 9.

## Configurations

| Entry                                 | When to use                                                     |
| ------------------------------------- | --------------------------------------------------------------- |
| `@strimz/eslint-config/base`          | Pure TypeScript libraries with no DOM or Node specifics.        |
| `@strimz/eslint-config/node`          | Node 22 services and CLIs.                                      |
| `@strimz/eslint-config/nestjs`        | NestJS apps — relaxes a few rules that conflict with DI.        |
| `@strimz/eslint-config/nextjs`        | Next.js 15 apps — adds React, React Hooks, and the Next plugin. |
| `@strimz/eslint-config/react-library` | Shared React libraries — adds React and React Hooks (no Next).  |

## Usage

In a consuming `eslint.config.js` (the file must be ESM — give the package `"type": "module"` or use `.mjs`):

```js
import config from '@strimz/eslint-config/nextjs'

export default config
```

Add `@strimz/eslint-config` and `eslint` as `devDependencies` of the consumer with `workspace:*` and `^9.18.0` respectively.

## Scope

These configs catch real bugs (no `eval`, no `==`, unused vars, missing await, banned debugger statements) and enforce TypeScript hygiene (consistent type imports, no `any` warnings). They do not enforce formatting — that is Prettier's job, and `eslint-config-prettier` is included to disable any conflicting rules.
