import { describe, expect, it } from 'vitest'
import { contactErrorMap, contactFormSchema } from './contact-form'

const VALID = {
  name: 'Alex',
  email: 'alex@example.com',
  topic: 'sales',
  message: 'We want to bill our customers monthly in USDC.',
}

function messages(values: Record<string, unknown>): Record<string, string> {
  const result = contactFormSchema.safeParse(values, { errorMap: contactErrorMap })
  if (result.success) return {}
  return Object.fromEntries(result.error.issues.map((i) => [String(i.path[0]), i.message]))
}

describe('contact form validation', () => {
  it('says what to do when the form is sent empty', () => {
    expect(messages({ name: '', email: '', company: '', topic: 'sales', message: '' })).toEqual({
      name: 'Enter your name.',
      email: 'Enter an email we can reply to.',
      message: 'Tell us a little about what you need.',
    })
  })

  it('treats a blank company as not given', () => {
    expect(messages({ ...VALID, company: '' })).toEqual({})
    expect(messages({ ...VALID, company: '   ' })).toEqual({})
    expect(contactFormSchema.parse({ ...VALID, company: '' }).company).toBeUndefined()
  })

  it('keeps a company that was filled in', () => {
    expect(contactFormSchema.parse({ ...VALID, company: 'Acme' }).company).toBe('Acme')
  })

  it('explains a name that is too short', () => {
    expect(messages({ ...VALID, name: 'A' }).name).toBe('Enter your name.')
  })

  it('explains an email that is not an address', () => {
    expect(messages({ ...VALID, email: 'alex' }).email).toBe('Enter an email we can reply to.')
  })

  it('asks for more detail on a short message', () => {
    expect(messages({ ...VALID, message: 'Hi there' }).message).toBe(
      'Add a little more detail (20 characters or more).',
    )
  })

  it('explains fields that are too long', () => {
    const long = (n: number) => 'x'.repeat(n)
    expect(messages({ ...VALID, name: long(121) }).name).toBe(
      'Keep your name under 120 characters.',
    )
    expect(messages({ ...VALID, company: long(121) }).company).toBe(
      'Keep the company name under 120 characters.',
    )
    expect(messages({ ...VALID, message: long(4001) }).message).toBe(
      'Keep your message under 4,000 characters.',
    )
  })

  it('never shows a raw zod message', () => {
    const all = Object.values(
      messages({ name: '', email: 'x', company: 'y'.repeat(200), topic: 'sales', message: '' }),
    )
    for (const text of all) {
      expect(text).not.toMatch(/String must|Invalid|character\(s\)/)
    }
  })
})
