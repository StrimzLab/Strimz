'use client'

import { useCallback } from 'react'
import { assertionForPrivy, requestOptionsFrom } from '@strimz/web-shared/lib/webauthn'
import type { StepUpAction } from '@strimz/web-shared/lib/merchant-api/resources/step-up'

import { useDashboardMode } from '@strimz/web-shared/lib/dashboard-mode'
import { useMerchantApi } from '@/hooks/api/merchant-api-context'
import { asksStrimzPasskey } from '@/lib/passkey-policy'

/** Asks for the merchant's passkey and returns a one-use token for `action`; none in test mode. */
export function useStepUp() {
  const api = useMerchantApi()
  const asks = asksStrimzPasskey(useDashboardMode())
  return useCallback(
    async (action: StepUpAction): Promise<string | undefined> => {
      if (!asks) return undefined
      const { options } = await api.stepUp.start(action)
      const credential = await navigator.credentials.get({ publicKey: requestOptionsFrom(options) })
      if (
        !(credential instanceof PublicKeyCredential) ||
        !(credential.response instanceof AuthenticatorAssertionResponse)
      ) {
        throw new Error('You cancelled the passkey prompt. Nothing was changed.')
      }
      const { response } = credential
      const { stepUpToken } = await api.stepUp.verify(
        action,
        assertionForPrivy({
          id: credential.id,
          rawId: credential.rawId,
          type: credential.type,
          response: {
            clientDataJSON: response.clientDataJSON,
            authenticatorData: response.authenticatorData,
            signature: response.signature,
            userHandle: response.userHandle,
          },
          getClientExtensionResults: () => credential.getClientExtensionResults(),
        }),
      )
      return stepUpToken
    },
    [api, asks],
  )
}
