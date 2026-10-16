import { describe, expect, it } from 'vitest'
import { tokenAmountSchema } from '../src/index.js'

describe('tokenAmountSchema', () => {
  it.each(['1.5', '-1', '1e6', '', ' 1', 'abc'])(
    'returns a validation error for %j instead of throwing',
    (input) => {
      const result = tokenAmountSchema.safeParse(input)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.code).toBe('invalid_string')
    },
  )

  it.each(['0', '1'.repeat(78)])('accepts %s', (input) => {
    expect(tokenAmountSchema.safeParse(input)).toEqual({ success: true, data: input })
  })
})
