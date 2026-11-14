import { spawn, type ChildProcess } from 'node:child_process'
import { afterAll, describe, expect, inject, it } from 'vitest'
import { httpOk, LogSink, waitFor } from '../src/process.js'
import { payViaCheckout } from '../test/flows.js'
import { db, eventually } from '../test/support.js'

const scheduler = inject('scheduler')
let restarted: ChildProcess | undefined

afterAll(async () => {
  if (restarted && restarted.exitCode === null) {
    const exited = new Promise((r) => restarted?.once('exit', r))
    restarted.kill('SIGTERM')
    await exited
  }
  await db().$disconnect()
})

function byId(id: string) {
  return db().webhookEvent.findUnique({ where: { id }, include: { deliveries: true } })
}

// Watching for a committed claim would tie the test to one dispatcher design; a backend
// blocked on the lock is the dispatcher mid-hydration under any design.
async function waitersOnPaymentSession(): Promise<number> {
  const rows = await db().$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM pg_locks
     WHERE relation = '"PaymentSession"'::regclass AND NOT granted`
  return Number(rows[0]?.n ?? 0n)
}

function eventFor(sessionId: string) {
  return db().webhookEvent.findFirst({
    where: {
      type: 'payment_completed',
      payload: { path: ['ref', 'sessionId'], equals: sessionId },
    },
    include: { deliveries: true },
  })
}

describe('chaos: the scheduler dies while dispatching', () => {
  // A restart lands between claim and hydrate in real life whenever a deploy or crash
  // hits a busy outbox. A table lock holds the dispatcher in that window so the kill
  // lands there every time.
  it('a payment.completed being dispatched by a scheduler that is then killed is delivered after restart', async () => {
    process.kill(scheduler.pid, 'SIGSTOP')

    const { sessionId, submission } = await payViaCheckout(2_000_000n)
    expect(submission.status).toBe('confirmed')
    const written = await eventually(
      'indexer writes the undispatched event',
      () => eventFor(sessionId),
      (e) => e !== null && e.dispatchedAt === null,
    )
    if (!written) throw new Error('no payment.completed event')
    const eventId = written.id

    let release: () => void = () => undefined
    const held = new Promise<void>((r) => (release = r))
    const lock = db().$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('LOCK TABLE "PaymentSession" IN ACCESS EXCLUSIVE MODE')
        await held
      },
      { maxWait: 10_000, timeout: 120_000 },
    )

    process.kill(scheduler.pid, 'SIGCONT')
    await eventually(
      'dispatcher picks the event and blocks hydrating it',
      () => waitersOnPaymentSession(),
      (n) => n > 0,
      30_000,
    )
    expect((await byId(eventId))?.deliveries).toHaveLength(0)

    process.kill(scheduler.pid, 'SIGKILL')
    release()
    await lock

    const log = new LogSink().stream('scheduler-restarted')
    restarted = spawn('node', ['dist/main.js'], {
      cwd: scheduler.cwd,
      env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', ...scheduler.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    restarted.stdout?.pipe(log, { end: false })
    restarted.stderr?.pipe(log, { end: false })
    await waitFor('restarted scheduler', 60_000, () => httpOk(scheduler.readyUrl))

    const after = await eventually(
      'the claimed event is delivered after the restart',
      () => byId(eventId),
      (e) => (e?.deliveries.length ?? 0) > 0,
      60_000,
    ).catch(async (err: unknown) => {
      const stranded = await byId(eventId)
      process.stdout.write(
        `\n=== chaos: stranded event ===\n${JSON.stringify(
          {
            dispatchedAt: stranded?.dispatchedAt,
            dispatchError: stranded?.dispatchError,
            deliveries: stranded?.deliveries.length,
            payload: stranded?.payload,
          },
          null,
          2,
        )}\n`,
      )
      throw err
    })
    expect(after?.deliveries).toHaveLength(1)
  })
})
