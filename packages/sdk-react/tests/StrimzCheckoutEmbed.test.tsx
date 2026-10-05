import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StrimzCheckoutEmbed, StrimzProvider } from '../src/index.js'

const validKey = 'pk_test_' + 'a'.repeat(20)

function iframeSrc(node: React.ReactNode): URL {
  render(
    <StrimzProvider publishableKey={validKey} checkoutOrigin="https://strimz.example">
      {node}
    </StrimzProvider>,
  )
  return new URL(screen.getByTitle('Strimz checkout').getAttribute('src') ?? '')
}

describe('<StrimzCheckoutEmbed/> theme', () => {
  it('passes the requested theme to the hosted checkout', () => {
    const src = iframeSrc(<StrimzCheckoutEmbed sessionId="sess_1" theme="dark" />)
    expect(src.pathname).toBe('/pay/sess_1')
    expect(src.searchParams.get('embed')).toBe('1')
    expect(src.searchParams.get('theme')).toBe('dark')
  })

  it('passes light the same way', () => {
    const src = iframeSrc(<StrimzCheckoutEmbed sessionId="sess_1" theme="light" />)
    expect(src.searchParams.get('theme')).toBe('light')
  })

  it('omits the parameter so the checkout follows the payer system preference', () => {
    const src = iframeSrc(<StrimzCheckoutEmbed sessionId="sess_1" />)
    expect(src.searchParams.has('theme')).toBe(false)
  })
})
