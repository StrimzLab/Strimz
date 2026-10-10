import { afterEach, describe, expect, it, vi } from 'vitest'

import { submitContact } from '../contact-submission'

const MESSAGE = {
  name: 'Ada Lovelace',
  email: 'ada@example.test',
  topic: 'sales' as const,
  message: 'We would like to talk about volume pricing for our business.',
}

function answer(status: number, body: unknown) {
  const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function refusal(code: string, message: string) {
  return { error: { code, message } }
}

describe('submitting the contact form', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts the message with the Turnstile token to the contact route', async () => {
    const fetchMock = answer(201, { ok: true })

    await submitContact({ ...MESSAGE, turnstileToken: 'tok_from_widget' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toMatch(/\/v1\/contact$/u)
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({
      ...MESSAGE,
      turnstileToken: 'tok_from_widget',
    })
  })

  it('tells the sender the bot check failed and to try it again', async () => {
    answer(403, refusal('bot_check_failed', 'bot check failed'))

    await expect(submitContact({ ...MESSAGE, turnstileToken: 'stale' })).rejects.toThrow(
      'We could not confirm you are a person. Complete the check again, then send.',
    )
  })

  it('tells the sender the message was not sent when email is unavailable', async () => {
    answer(502, refusal('email_unavailable', 'the message could not be sent; try again later'))

    await expect(submitContact({ ...MESSAGE, turnstileToken: 'tok' })).rejects.toThrow(
      'Your message was not sent. Try again in a few minutes.',
    )
  })

  it('tells the sender to wait after too many messages', async () => {
    answer(429, refusal('rate_limited', 'too many requests'))

    await expect(submitContact({ ...MESSAGE, turnstileToken: 'tok' })).rejects.toThrow(
      'Too many messages from your network. Try again in an hour.',
    )
  })

  it('still shows the API message for any other refusal', async () => {
    answer(400, refusal('validation_error', 'message must be at least 20 characters'))

    await expect(submitContact({ ...MESSAGE, turnstileToken: 'tok' })).rejects.toThrow(
      'message must be at least 20 characters',
    )
  })
})
