/**
 * Typed errors thrown by `ChainAdapterRegistry` and adapter
 * implementations. Callers catch these to render structured codes in
 * API responses rather than generic 500s.
 */

/** Base — every adapter error inherits, so callers can `instanceof` once. */
export class ChainAdapterError extends Error {
  /** Stable machine-readable code. */
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'ChainAdapterError'
    this.code = code
  }
}

/**
 * Thrown by `registry.get()` when no adapter is registered for the
 * supplied chain id. Usually a config/seed bug, not a runtime issue.
 */
export class ChainNotFoundError extends ChainAdapterError {
  constructor(chainId: string) {
    super('chain_not_found', `no adapter registered for chain "${chainId}"`)
    this.name = 'ChainNotFoundError'
  }
}

/**
 * Thrown by an adapter method that hasn't been wired yet. Lets
 * milestones land in stages — the port defines the full interface but
 * concrete adapters can throw `AdapterNotImplementedError` for methods
 * that ship in a later milestone.
 */
export class AdapterNotImplementedError extends ChainAdapterError {
  constructor(chainId: string, method: string) {
    super('adapter_not_implemented', `adapter for "${chainId}" has not implemented "${method}" yet`)
    this.name = 'AdapterNotImplementedError'
  }
}

/**
 * Thrown when an envelope crosses the adapter boundary but the chain
 * id stamped on it doesn't match the adapter it was handed to. Strong
 * indicator of a misrouted submission and worth a 4xx, not a 500.
 */
export class ChainMismatchError extends ChainAdapterError {
  constructor(expected: string, received: string) {
    super('chain_mismatch', `envelope chain id "${received}" does not match adapter "${expected}"`)
    this.name = 'ChainMismatchError'
  }
}

/**
 * Thrown by `validateAddress` / `normaliseAddress` when the supplied
 * string isn't a well-formed address for the adapter's chain.
 */
export class InvalidAddressError extends ChainAdapterError {
  constructor(chainId: string, address: string) {
    super('invalid_address', `"${address}" is not a valid address on ${chainId}`)
    this.name = 'InvalidAddressError'
  }
}
