'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import {
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@strimz/ui'

const ContactSchema = z.object({
  name: z.string().min(2, 'Name is too short'),
  email: z.string().email('Enter a valid email address'),
  company: z.string().optional(),
  topic: z.enum(['sales', 'support', 'partnership', 'security', 'other']),
  message: z.string().min(20, 'Tell us a bit more (min 20 characters)'),
})

type FormValues = z.infer<typeof ContactSchema>

/**
 * Marketing contact form. Validates with Zod via RHF, mocks a 600ms
 * submit, fires a sonner toast. Replace the `await new Promise` line
 * with the real `/v1/contact` POST when the backend ships.
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
    resolver: zodResolver(ContactSchema),
    defaultValues: { topic: 'sales' },
  })

  async function onSubmit(_values: FormValues) {
    await new Promise((r) => setTimeout(r, 600))
    toast.success("Message sent — we'll reply within 1 business day")
    setSubmitted(true)
    reset()
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
        <Label htmlFor="topic" className="text-[13px] text-[#58556A]">
          What&apos;s this about?
        </Label>
        <Select
          defaultValue="sales"
          onValueChange={(v) => setValue('topic', v as FormValues['topic'])}
        >
          <SelectTrigger id="topic" className="h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sales">Sales — pricing, plans, contracts</SelectItem>
            <SelectItem value="support">Support — bugs, integration help</SelectItem>
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
