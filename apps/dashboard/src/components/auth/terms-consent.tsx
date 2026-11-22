'use client'

import { Checkbox } from '@strimz/ui'
import { siteUrls } from '@strimz/web-shared/lib/site-urls'

export function TermsConsent({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-start gap-3">
      <Checkbox
        id="accept-terms"
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
        aria-required="true"
        className="mt-0.5"
      />
      <label htmlFor="accept-terms" className="text-muted-foreground text-sm leading-6">
        I agree to the{' '}
        <a
          href={`${siteUrls.site}/legal/terms`}
          target="_blank"
          rel="noreferrer"
          className="text-foreground underline underline-offset-2"
        >
          Terms of Service
        </a>{' '}
        and the{' '}
        <a
          href={`${siteUrls.site}/legal/privacy`}
          target="_blank"
          rel="noreferrer"
          className="text-foreground underline underline-offset-2"
        >
          Privacy Policy
        </a>
        . <span className="text-xs">(required)</span>{' '}
        <span aria-hidden="true" className="text-danger">
          *
        </span>
      </label>
    </div>
  )
}
