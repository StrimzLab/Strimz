'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import {
  Input,
  FieldLabel,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@strimz/ui'
import { contactRequestInputSchema, type ContactRequestInput } from '@strimz/shared-types'
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
    try {
      const res = await fetch(`${env.apiUrl.replace(/\/$/, '')}/v1/contact`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error?.message ?? `Something went wrong (${res.status})`)
      }
      toast.success("Message sent. We'll reply within 1 business day")
      setSubmitted(true)
      reset()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  if (submitted) {
    return (
      <div className="mt-6 rounded-[12px] border border-[#02C76A]/30 bg-[#02C76A]/5 p-5">
        <p className="font-sora text-base font-[600] text-[#050020]">Message sent ✨</p>
        <p className="font-poppins mt-1 text-sm text-[#58556A]">
          We&apos;ll get back within 1 business day. Watch your inbox.
        </p>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="font-poppins mt-3 text-sm font-[500] text-[#02C76A] hover:underline"
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
          label="Your name"
          error={errors.name?.message}
          input={<Input id="name" placeholder="Alex" autoComplete="name" {...register('name')} />}
        />
        <Field
          id="email"
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
        label="Company"
        error={errors.company?.message}
        input={
          <Input
            id="company"
            placeholder="(optional)"
            autoComplete="organization"
            {...register('company')}
          />
        }
      />

      <div className="grid gap-1.5">
        <FieldLabel htmlFor="topic" className="text-[13px] text-[#58556A]" required>
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

      <button
        type="submit"
        disabled={isSubmitting}
        className="font-poppins shadow-cta inline-flex h-[44px] items-center justify-center gap-2 rounded-[8px] bg-[#02C76A] text-sm font-[600] text-white transition-transform hover:scale-[1.01] disabled:scale-100 disabled:opacity-70"
      >
        {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        {isSubmitting ? 'Sending…' : 'Send message'}
      </button>
    </form>
  )
}

function Field({
  id,
  label,
  error,
  input,
}: {
  id: string
  label: string
  error?: string
  input: React.ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-[13px] text-[#58556A]">
        {label}
      </Label>
      {input}
      {error ? <p className="font-poppins text-[12px] text-rose-600">{error}</p> : null}
    </div>
  )
}
