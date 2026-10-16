import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = join(__dirname, '..', '..')

function read(path: string): string {
  return readFileSync(join(WEB_ROOT, path), 'utf8')
}

describe('marketing contact form', () => {
  const form = read('src/components/marketing/contact-form.tsx')

  it('renders the Turnstile widget for the contact action', () => {
    expect(form).toMatch(/<TurnstileWidget\b[^>]*\baction="contact"/u)
  })

  it('submits through the client that sends the Turnstile token', () => {
    expect(form).toMatch(/submitContact\(/u)
    expect(form).not.toMatch(/fetch\(/u)
  })

  it('shows a refused submission inline', () => {
    expect(form).toMatch(/role="alert"/u)
  })

  it.each(['name', 'email', 'message'])('labels the %s field as required', (id) => {
    expect(form).toMatch(new RegExp(`<Field\\s+id="${id}"\\s+required\\s`, 'u'))
  })

  it('labels the company field as optional', () => {
    expect(form).toMatch(/<Field\s+id="company"\s+required=\{false\}/u)
  })

  it('labels every field with the shared required / optional label', () => {
    expect(form).toMatch(/<FieldLabel htmlFor=\{id\}[^>]*required=\{required\}/u)
    expect(form).not.toMatch(/<Label\b/u)
  })
})
