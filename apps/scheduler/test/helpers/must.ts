/** Returns the value, or fails the test when it is missing. */
export function must<T>(value: T | null | undefined, what = 'value'): T {
  if (value === null || value === undefined) {
    throw new Error(`expected ${what} to be present`)
  }
  return value
}
