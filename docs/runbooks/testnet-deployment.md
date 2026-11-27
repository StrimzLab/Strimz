# Runbook: the test deployment (Arc testnet)

Background: [ADR-2026-11-26-test-mode](../adr/ADR-2026-11-26-test-mode.md).

Test mode is a second backend on the same OVH server as live. Each backend has one chain and one mode, and the two never share a database.

|           | Live                         | Test                                 |
| --------- | ---------------------------- | ------------------------------------ |
| Container | `strimz` on `127.0.0.1:8081` | `strimz-testnet` on `127.0.0.1:8082` |
| Env file  | `~/strimz/.env.mainnet`      | `~/strimz/.env.testnet`              |
| Volume    | `strimz-mainnet-data`        | `strimz-data`                        |
| API host  | `api.strimz.finance`         | `api-test.strimz.finance`            |
| Checkout  | `strimz-checkout`            | `strimz-checkout-test`               |
| Memory    | no cap                       | `--memory=768m`                      |
| Signers   | Privy server wallets         | software keys in the env file        |
| Backups   | nightly                      | none                                 |

Docker needs `sudo` on the server. Never touch the `solva-*` containers or ports 8080 and 8090.

## 1. Swap that survives a reboot

```sh
swapon --show                       # /swapfile and /swapfile2 are listed
grep -q '^/swapfile ' /etc/fstab  || echo '/swapfile  none swap sw 0 0' | sudo tee -a /etc/fstab
grep -q '^/swapfile2 ' /etc/fstab || echo '/swapfile2 none swap sw 0 0' | sudo tee -a /etc/fstab
sudo swapon -a && swapon --show
```

## 2. Contracts

Testnet has no Safe or timelock. The testnet deployer key keeps the admin roles and acts alone, because nothing on testnet holds real money.

From `packages/contracts`, with its testnet `.env` loaded, run sections 1 to 3 of [testnet-redeploy.md](testnet-redeploy.md):

1. Rehearse.
2. Deploy core and agent.
3. Verify (`deployed`).

Skip the admin handoff in section 4. Instead, pause the agent escrow with the deployer key, then publish the source:

```sh
arc-cast send "$STRIMZ_AGENT_ESCROW_ADDRESS" "pause()" --private-key "$STRIMZ_DEPLOYER_PRIVATE_KEY" --rpc-url arc_testnet
./script/verify.sh core && ./script/verify.sh agent
```

The `.env` may still list an older deploy's addresses. Unset them before `DeployCore`, and export the new core addresses from `deployments/5042002.json` before `DeployAgent`.

The relayer and scheduler addresses passed to `DeployCore` are the software keys from step 3, so create those first. Step 4 starts the test database empty, so the old contracts' data isn't carried over.

## 3. The env file

`~/strimz/.env.testnet` (root, mode 600) starts from the old testnet `~/strimz/.env`. Then make these changes:

- **Contracts:** set `START_BLOCK` and every contract address to the new deploy. Leave `TIMELOCK_ADDRESS`, `STRIMZ_SAFE_ADDRESS` and `STRIMZ_GUARDIAN_ADDRESS` unset.
- **Privy:** copy `PRIVY_APP_ID`, `PRIVY_APP_SECRET` and `PRIVY_WEBHOOK_SIGNING_SECRET` from `.env.mainnet`, so one Privy login works on both backends.
- **URLs:**
  - `API_BASE_URL=https://api-test.strimz.finance`
  - `CHECKOUT_ORIGIN=https://checkout-test.strimz.finance`
  - `STRIMZ_DASHBOARD_URL=https://app.strimz.finance`
  - `STRIMZ_ADMIN_URL=https://admin.strimz.finance`
  - `CORS_ORIGIN=https://strimz.finance,https://app.strimz.finance,https://admin.strimz.finance,https://checkout-test.strimz.finance`
- **Signers:**
  - `KMS_PROVIDER=software` with `KMS_SOFTWARE_PRIVATE_KEY` (relayer);
  - `SCHEDULER_SIGNER_PROVIDER=software` with `SCHEDULER_PRIVATE_KEY`;
  - `REFUND_SIGNER_PROVIDER=software` with `REFUND_PRIVATE_KEY`.

  Create each key on the server, straight into the file. Never print a key: print only its address, then fund that address from `faucet.circle.com`.

- **Stays as is:** `ARC_ENVIRONMENT=testnet`, `ARC_CHAIN_ID=5042002`, and the testnet RPC URLs.

## 4. Start the container

The image is the same tag the live container runs (`docker inspect strimz --format '{{.Config.Image}}'`).

```sh
sudo docker volume rm strimz-data && sudo docker volume create strimz-data   # first time only: start empty
sudo docker run -d --name strimz-testnet \
  --restart unless-stopped \
  --memory=768m --memory-swap=1536m \
  --env-file ~/strimz/.env.testnet \
  -v strimz-data:/data \
  -p 127.0.0.1:8082:80 \
  <image>
sudo docker exec strimz-testnet supervisorctl status     # every program RUNNING
curl -s http://127.0.0.1:8082/health
```

Bootstrap the super admin on the test backend too, with the same Privy DID as live:

```sh
sudo docker exec strimz-testnet sh -c \
  'cd /repo/apps/api && node dist/cli/admin-bootstrap.main.js --privy-did <did> --name "<name>"'
```

## 5. Caddy

Add to `/etc/caddy/Caddyfile`, next to the `api.strimz.finance` block:

```
api-test.strimz.finance {
	encode gzip
	reverse_proxy 127.0.0.1:8082
}
```

```sh
sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy
curl -s https://api-test.strimz.finance/health
```

The DNS record `api-test` points at the server the same way `api` does.

## 6. The test checkout Worker

`apps/checkout/wrangler.jsonc` has a `test` environment named `strimz-checkout-test`. Create the Worker as in [cloudflare-workers.md](cloudflare-workers.md), with:

- **Deploy command:** `cd apps/checkout && pnpm exec opennextjs-cloudflare deploy --env test`.
- **Build variables:**
  - `NEXT_PUBLIC_APP_URL=https://checkout-test.strimz.finance` and `NEXT_PUBLIC_API_URL=https://api-test.strimz.finance`;
  - `NEXT_PUBLIC_ARC_ENVIRONMENT=testnet` and a testnet `NEXT_PUBLIC_ARC_RPC_URL`;
  - a `pk_test_` key from Strimz's own test account;
  - the testnet contract and USDC addresses.
- **Custom domain:** `checkout-test.strimz.finance`.

## Releasing

Every backend release goes to both containers:

1. Deploy live first.
2. When `strimz` is healthy, recreate `strimz-testnet` with the same image, using step 4 without the volume reset.
3. Check `strimz`, `strimz-testnet` and the Solva containers.

Remove an old image only when neither container uses it.

## Checks

- **Memory:** `sudo docker stats --no-stream` shows `strimz-testnet` under 768 MiB. If it often hits the cap, it slows down while live doesn't. Plan a bigger server rather than lifting the cap.
- **Relayer balance:** check the testnet relayer's USDC on `explorer.testnet.arc.io`. Top it up from the faucet before it runs dry, or test sign-ups and payments stop.
- **Rollback:** `sudo docker stop strimz-testnet`. Live isn't affected.
