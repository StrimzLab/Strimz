import { Logger } from '@nestjs/common'
import { PrivyPolicyViolationError, type PrivyWalletApi } from '@strimz/signer'

import type { EmailService } from '../email/email.service.js'

/** Wraps the wallet API so a policy refusal reaches ops once per wallet, then still fails. */
export function alertOnPolicyRefusal(
  api: PrivyWalletApi,
  email: EmailService,
  to: string,
): PrivyWalletApi {
  const log = new Logger('PrivySigner')
  const alerted = new Set<string>()
  return {
    walletAddress: (walletId) => api.walletAddress(walletId),
    async signTransaction(walletId, transaction) {
      try {
        return await api.signTransaction(walletId, transaction)
      } catch (err) {
        if (err instanceof PrivyPolicyViolationError && !alerted.has(walletId)) {
          alerted.add(walletId)
          const subject = `Privy refused to sign for scheduler wallet ${walletId}`
          log.error(`${subject}: call to ${transaction.to}`)
          await email
            .send({
              to,
              subject,
              html: `<p>The wallet's Privy policy refused a call to <code>${transaction.to}</code>. Nothing was sent. If Strimz didn't change its contracts or calls, treat the server's Privy key as exposed and remove it from the wallet with the owner key.</p>`,
            })
            .catch((mailErr: unknown) =>
              log.error(`${subject}: alert email failed: ${(mailErr as Error).message}`),
            )
        }
        throw err
      }
    },
  }
}
