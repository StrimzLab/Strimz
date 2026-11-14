// Server build stand-in for browser-only SDKs (see `browserOnly` in base-config.mjs).
// Their provider tree is mounted with `ssr: false`, so nothing runs them on the server.
module.exports = new Proxy(
  {},
  {
    get(_, name) {
      if (name === '__esModule') return false
      if (typeof name !== 'string' || name === 'then') return undefined
      return () => {
        throw new Error(`${name} is browser-only; render it inside the client provider tree`)
      }
    },
  },
)
