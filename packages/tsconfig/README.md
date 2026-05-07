# @strimz/tsconfig

Shared TypeScript configurations for every package and app in the Strimz monorepo.

## Configurations

| Config               | When to use                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `base.json`          | The shared strict-mode foundation. Other configs extend this.                              |
| `node.json`          | Node 22 services that emit JS (e.g. `apps/api` build tooling).                             |
| `library.json`       | Pure TypeScript libraries that publish types (e.g. `@strimz/sdk`, `@strimz/shared-types`). |
| `nestjs.json`        | NestJS apps and packages — enables CommonJS, decorators, and decorator metadata.           |
| `nextjs.json`        | Next.js 15 apps — DOM lib, JSX preserve, `noEmit`, the `next` plugin.                      |
| `react-library.json` | Shared React libraries (`@strimz/sdk-react`, `@strimz/ui`).                                |

## Usage

In any consuming `tsconfig.json`:

```json
{
  "extends": "@strimz/tsconfig/library.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src"]
}
```

Add `@strimz/tsconfig` as a `devDependency` of the consumer with `workspace:*`.
