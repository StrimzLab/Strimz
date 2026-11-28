# Strimz SDKs

The source of the Strimz SDKs, as published on npm. Strimz takes one-time payments, subscriptions and invoices in USDC and EURC.

> **Read-only mirror.** This repository is copied automatically from Strimz's own repository after every change, so it always matches what ships. Pull requests here aren't merged; email support@strimz.finance instead.

| Package                                            | npm                                                                            | What it is                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------- |
| [`packages/sdk`](packages/sdk)                     | [`@strimz/sdk`](https://www.npmjs.com/package/@strimz/sdk)                     | Server SDK for Node 18+ and Bun                         |
| [`packages/sdk-react`](packages/sdk-react)         | [`@strimz/sdk-react`](https://www.npmjs.com/package/@strimz/sdk-react)         | React provider, pay button and checkout hooks           |
| [`packages/shared-config`](packages/shared-config) | [`@strimz/shared-config`](https://www.npmjs.com/package/@strimz/shared-config) | Networks, tokens and plans                              |
| [`packages/shared-crypto`](packages/shared-crypto) | [`@strimz/shared-crypto`](https://www.npmjs.com/package/@strimz/shared-crypto) | Webhook signatures, EIP-712 checkout types, key formats |
| [`packages/shared-types`](packages/shared-types)   | [`@strimz/shared-types`](https://www.npmjs.com/package/@strimz/shared-types)   | API resource types and schemas                          |

To use them, install from npm: `pnpm add @strimz/sdk`. The packages here build inside Strimz's workspace, so this copy is for reading.

- Docs: [docs.strimz.finance](https://docs.strimz.finance/docs)
- A full example integration: [Fanline](https://github.com/StrimzLab/fanline)
- Smart contracts: [strimz-contracts](https://github.com/StrimzLab/strimz-contracts)

MIT licensed. See [LICENSE](LICENSE).
