import { describe, expect, it } from 'vitest'

import { isValidStellarPayoutAddress, normaliseStellarAddress } from './address.js'

// Real-world Strkey samples — these are valid checksummed addresses
// from the Stellar reference test fixtures. Verified by paste-into
// stellar.expert; we use them here so the test catches both
// well-formed acceptances and Strkey checksum rejections.
const VALID_G = 'GDVEU3DD4KOFECV66VIHWEZOYX4ZKR3WV27L464SIIPOU2IUI3JCZA57'
const VALID_C = 'CA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUWDA'

describe('isValidStellarPayoutAddress', () => {
  it('accepts a valid G-account', () => {
    expect(isValidStellarPayoutAddress(VALID_G)).toBe(true)
  })

  it('accepts a valid C-contract address', () => {
    expect(isValidStellarPayoutAddress(VALID_C)).toBe(true)
  })

  it('rejects empty input', () => {
    expect(isValidStellarPayoutAddress('')).toBe(false)
  })

  it('rejects an EVM address', () => {
    expect(isValidStellarPayoutAddress('0x272c7218ccceebd62a04e284091e0bc702b60e77')).toBe(false)
  })

  it('rejects a G-account with a single corrupted character', () => {
    // Last char flipped — checksum should reject.
    const corrupted = VALID_G.slice(0, -1) + 'X'
    expect(isValidStellarPayoutAddress(corrupted)).toBe(false)
  })

  it('rejects an S-seed (secret) even though it is well-formed Strkey', () => {
    // Generated secret — we never want a payout field to accept this.
    expect(
      isValidStellarPayoutAddress('SC4D7B3PRGTLZW2GTW2I7VTNQRLDR4ZHFRDIE2RNTQGVMNVT4VJ4XGAM'),
    ).toBe(false)
  })

  it('rejects an M-muxed account', () => {
    // Muxed accounts encode a subaccount selector; not a payout
    // destination Strimz supports today.
    expect(
      isValidStellarPayoutAddress(
        'MDLY3OYJWADWRWG5OGTAFRWXZ4WUYABDLP66ZRSGTHM5GRH6FBYJJAAAAAAAA37IAAAA',
      ),
    ).toBe(false)
  })
})

describe('normaliseStellarAddress', () => {
  it('returns valid addresses unchanged', () => {
    expect(normaliseStellarAddress(VALID_G)).toBe(VALID_G)
    expect(normaliseStellarAddress(VALID_C)).toBe(VALID_C)
  })

  it('throws on invalid input', () => {
    expect(() => normaliseStellarAddress('not-an-address')).toThrow()
  })
})
