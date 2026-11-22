import type { LocalAccount } from 'viem'

import { toKmsAccount } from './kms-account.js'
import type { KmsSigner } from './kms-signer.js'
import type { PrivyServerSigner } from './privy-server-signer.js'

/** Any signer a Strimz service can send transactions with. */
export type TransactionSigner = KmsSigner | PrivyServerSigner

export function toSignerAccount(signer: TransactionSigner): LocalAccount {
  return 'kind' in signer && signer.kind === 'privy'
    ? signer.toAccount()
    : toKmsAccount(signer as KmsSigner)
}
