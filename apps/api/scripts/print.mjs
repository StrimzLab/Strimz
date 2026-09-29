import { format } from 'node:util'

/** Writes one line of script output to stdout, formatted the way `console.log` formats it. */
export function print(...args) {
  process.stdout.write(`${format(...args)}\n`)
}
