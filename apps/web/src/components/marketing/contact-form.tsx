'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import {
  Input,
  FieldLabel,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@strimz/ui'
import { contactRequestInputSchema, type ContactRequestInput } from '@strimz/shared-types'
import { TurnstileWidget } from '@/components/turnstile-widget'
import { submitContact } from '@/lib/contact-submission'
import { env } from '@/lib/env'

type FormValues = ContactRequestInput

/**
 * Marketing contact form. Validates client-side with the shared
 * `contactRequestInputSchema` (same shape apps/api enforces) and
 * POSTs to `POST /v1/contact` ,  the backend routes the message
 * straight into Strimz's support inbox via Resend and replies to
 * the submitter's own email address.
 */
export function ContactForm() {
  const [submitted, setSubmitted] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(contactRequestInputSchema),
    defaultValues: { topic: 'sales' },
  })

  async function onSubmit(values: FormValues) {
    if (env.turnstileSiteKey && !turnstileToken) {
      setSubmitError('Complete the check above, then send.')
      return
    }
    setSubmitError(null)
    try {
      await submitContact({ ...values, turnstileToken: turnstileToken ?? undefined })
      toast.success("Message sent. We'll reply within 1 business day")
      setSubmitted(true)
      reset()
    } catch (err) {
      const message = (err as Error).message
      setSubmitError(message)
      toast.error(message)
    } finally {
      setTurnstileToken(null)
      setTurnstileResetKey((key) => key + 1)
    }
  }

  if (submitted) {
    return (
      <div className="border-accent/30 bg-accent/5 mt-6 rounded-[12px] border p-5">
        <p className="font-sora text-foreground text-base font-[600]">Message sent ✨</p>
        <p className="font-poppins text-muted-foreground mt-1 text-sm">
          We&apos;ll get back within 1 business day. Watch your inbox.
        </p>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="font-poppins text-accent mt-3 text-sm font-[500] hover:underline"
        >
          Send another message →
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="font-poppins mt-6 grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          id="name"
          required
          label="Your name"
          error={errors.name?.message}
          input={<Input id="name" placeholder="Alex" autoComplete="name" {...register('name')} />}
        />
        <Field
          id="email"
          required
          label="Work email"
          error={errors.email?.message}
          input={
            <Input
              id="email"
              type="email"
              placeholder="alex@your-co.com"
              autoComplete="email"
              {...register('email')}
            />
          }
        />
      </div>

      <Field
        id="company"
        required={false}
        label="Company"
        error={errors.company?.message}
        input={
          <Input
            id="company"
            placeholder="Acme Inc."
            autoComplete="organization"
            {...register('company')}
          />
        }
      />

      <div className="grid gap-1.5">
        <FieldLabel htmlFor="topic" className="text-muted-foreground text-[13px]" required>
          What&apos;s this about?
        </FieldLabel>
        <Select
          defaultValue="sales"
          onValueChange={(v) => setValue('topic', v as FormValues['topic'])}
        >
          <SelectTrigger id="topic" className="h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sales">Sales. Pricing, plans, contracts</SelectItem>
            <SelectItem value="support">Support. Bugs, integration help</SelectItem>
            <SelectItem value="partnership">Partnership / co-marketing</SelectItem>
            <SelectItem value="security">Security disclosure</SelectItem>
            <SelectItem value="other">Something else</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Field
        id="message"
        required
        label="Message"
        error={errors.message?.message}
        input={
          <Textarea
            id="message"
            rows={5}
            placeholder="Tell us what you're building, what you're stuck on, or what you want to know."
            {...register('message')}
          />
        }
      />

      <TurnstileWidget
        action="contact"
        resetKey={turnstileResetKey}
        onToken={setTurnstileToken}
        className="flex justify-center"
      />

      {submitError ? (
        <p
          role="alert"
          className="font-poppins rounded-[8px] border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[13px] text-rose-600 dark:text-rose-400"
        >
          {submitError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="font-poppins shadow-cta bg-accent inline-flex h-[44px] items-center justify-center gap-2 rounded-[8px] text-sm font-[600] text-white transition-transform hover:scale-[1.01] disabled:scale-100 disabled:opacity-70"
      >
        {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        {isSubmitting ? 'Sending…' : 'Send message'}
      </button>
    </form>
  )
}

function Field({
  id,
  required,
  label,
  error,
  input,
}: {
  id: string
  required: boolean
  label: string
  error?: string
  input: React.ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <FieldLabel htmlFor={id} className="text-muted-foreground text-[13px]" required={required}>
        {label}
      </FieldLabel>
      {input}
      {error ? <p className="font-poppins text-[12px] text-rose-600">{error}</p> : null}
    </div>
  )
}
