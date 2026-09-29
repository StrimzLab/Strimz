import { format } from 'node:util'

export function print(...args) {
  process.stdout.write(`${format(...args)}\n`)
}
