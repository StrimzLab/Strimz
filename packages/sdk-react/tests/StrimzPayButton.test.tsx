import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StrimzPayButton, StrimzProvider } from '../src/index.js'

const validKey = 'pk_test_' + 'a'.repeat(20)

function withProvider(node: React.ReactNode) {
  return <StrimzProvider publishableKey={validKey}>{node}</StrimzProvider>
}

describe('<StrimzPayButton/>', () => {
  it('renders a button with the default label', () => {
    render(withProvider(<StrimzPayButton sessionId="sess_1" />))
    expect(screen.getByRole('button')).toBeInTheDocument()
    expect(screen.getByText(/Pay with Strimz/i)).toBeInTheDocument()
  })

  it('accepts a custom label', () => {
    render(withProvider(<StrimzPayButton sessionId="sess_1" label="Subscribe →" />))
    expect(screen.getByText('Subscribe →')).toBeInTheDocument()
  })

  it('calls window.open on click in popup mode', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue({ closed: false } as Window)
    render(withProvider(<StrimzPayButton sessionId="sess_42" />))
    fireEvent.click(screen.getByRole('button'))
    expect(open).toHaveBeenCalledTimes(1)
    expect(open.mock.calls[0]?.[0]).toContain('sess_42')
    open.mockRestore()
  })

  it('forwards ref', () => {
    const ref = { current: null as HTMLButtonElement | null }
    render(withProvider(<StrimzPayButton sessionId="sess_1" ref={ref} />))
    expect(ref.current).not.toBeNull()
  })

  it('throws helpful error if used outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => render(<StrimzPayButton sessionId="sess_1" />)).toThrow(/StrimzProvider/)
    spy.mockRestore()
  })
})
