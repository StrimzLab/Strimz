import { spawn, type ChildProcess } from 'node:child_process'
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  type WriteStream,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
export const CONTRACTS_DIR = join(REPO_ROOT, 'packages/contracts')
export const LOG_DIR = join(REPO_ROOT, 'e2e/full-stack/.logs')

export class LogSink {
  private readonly streams = new Map<string, WriteStream>()

  constructor() {
    mkdirSync(LOG_DIR, { recursive: true })
  }

  file(name: string): string {
    return join(LOG_DIR, `${name}.log`)
  }

  stream(name: string): WriteStream {
    let s = this.streams.get(name)
    if (!s) {
      s = createWriteStream(this.file(name), { flags: 'w' })
      this.streams.set(name, s)
    }
    return s
  }

  attach(name: string, child: ChildProcess): void {
    const out = this.stream(name)
    child.stdout?.pipe(out, { end: false })
    child.stderr?.pipe(out, { end: false })
  }

  close(): void {
    for (const s of this.streams.values()) s.end()
  }
}

export function run(
  command: string,
  args: string[],
  opts: { cwd: string; env?: Record<string, string>; log: LogSink; label: string },
): Promise<void> {
  const name = opts.label.replace(/[^A-Za-z0-9.-]+/g, '_')
  const child = spawn(command, args, {
    cwd: opts.cwd,
    env: { ...process.env, ...opts.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  opts.log.attach(name, child)
  return new Promise((resolvePromise, reject) => {
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolvePromise()
      else reject(new Error(`${command} ${opts.label} exited ${code}; see ${opts.log.file(name)}`))
    })
  })
}

export interface Service {
  name: string
  child: ChildProcess
}

export function startService(
  name: string,
  command: string,
  args: string[],
  opts: { cwd: string; env: Record<string, string>; log: LogSink; requires: string },
): Service {
  if (!existsSync(join(opts.cwd, opts.requires))) {
    throw new Error(`${name} is not built: ${join(opts.cwd, opts.requires)} is missing`)
  }
  const child = spawn(command, args, {
    cwd: opts.cwd,
    env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', ...opts.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  opts.log.attach(name, child)
  child.on('exit', (code, signal) => {
    if (signal !== 'SIGTERM') {
      opts.log
        .stream(name)
        .write(`\n[harness] ${name} exited unexpectedly: code=${code} signal=${signal}\n`)
    }
  })
  return { name, child }
}

export async function stopAll(children: Array<ChildProcess | undefined>): Promise<void> {
  await Promise.all(
    children.map(
      (c) =>
        new Promise<void>((done) => {
          if (!c || c.exitCode !== null || c.signalCode !== null) return done()
          c.once('exit', () => done())
          c.kill('SIGTERM')
        }),
    ),
  )
}

export async function waitFor(
  what: string,
  timeoutMs: number,
  check: () => Promise<boolean>,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown
  while (Date.now() < deadline) {
    try {
      if (await check()) return
    } catch (err) {
      lastError = err
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  const reason = lastError instanceof Error ? `: ${lastError.message}` : ''
  throw new Error(`timed out after ${timeoutMs}ms waiting for ${what}${reason}`)
}

/** The last lines of every service log, for a failure message CI can show. */
export function logTails(lines = 40): string {
  if (!existsSync(LOG_DIR)) return ''
  return readdirSync(LOG_DIR)
    .filter((f) => f.endsWith('.log'))
    .map((f) => {
      const tail = readFileSync(join(LOG_DIR, f), 'utf8').trimEnd().split('\n').slice(-lines)
      return `--- ${f} ---\n${tail.join('\n')}`
    })
    .join('\n')
}

export async function httpOk(url: string): Promise<boolean> {
  const res = await fetch(url)
  return res.ok
}
