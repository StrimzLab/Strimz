import { describe, expect, it } from 'vitest'
import {
  inviteAcceptUrl,
  inviteAcceptUrlForResponse,
} from '../../../../src/modules/admin/admin-invite-url.js'

describe('admin invite accept URL', () => {
  it('builds the dashboard accept link', () => {
    expect(inviteAcceptUrl('https://strimz.finance/', 'a_b-c')).toBe(
      'https://strimz.finance/admin/accept-invite?token=a_b-c',
    )
  })

  it('is returned in API responses outside production only', () => {
    expect(inviteAcceptUrlForResponse('development', 'http://localhost:3000', 'tok')).toBe(
      'http://localhost:3000/admin/accept-invite?token=tok',
    )
    expect(inviteAcceptUrlForResponse('test', 'http://localhost:3000', 'tok')).toBeDefined()
    expect(
      inviteAcceptUrlForResponse('production', 'https://strimz.finance', 'tok'),
    ).toBeUndefined()
  })
})
