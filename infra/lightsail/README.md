# Strimz on AWS Lightsail — single-container deploy

The setup that runs everything the platform needs — API, scheduler, agent, indexer, postgres, redis, nginx — inside one container on the smallest Lightsail Instance ($5/month, free for the first three months of a new AWS account).

## What ships in the container

| Process          | Internal port | Exposed?  | Purpose                                 |
| ---------------- | ------------- | --------- | --------------------------------------- |
| `nginx`          | 80            | ✅        | Reverse proxy — the only door           |
| `apps/api`       | 4000          | via nginx | NestJS/Fastify HTTP surface             |
| `apps/scheduler` | 4200          | ❌        | BullMQ cron worker + health server      |
| `apps/agent`     | 4300          | ❌        | AI cron worker + health server          |
| `apps/indexer`   | 4100          | ❌        | Go event indexer                        |
| `postgres`       | 5432          | ❌        | Local Postgres 16 (persisted to volume) |
| `redis`          | 6379          | ❌        | Local Redis 7 (persisted to volume)     |
| `supervisord`    | —             | —         | Owns every process, restarts on crash   |

Data survives container restarts via a Docker volume mount at `/data`.

## Pre-requisites

- An AWS account (personal is fine — free tier applies)
- A domain (optional but recommended for TLS)

## 1 · Create the Lightsail Instance

AWS Console → **Lightsail** → **Create instance**:

| Setting           | Value                                                                                                                                                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instance location | Region closest to your users                                                                                                                                                                                          |
| Platform          | Linux/Unix                                                                                                                                                                                                            |
| Blueprint         | **OS Only → Ubuntu 22.04 LTS**                                                                                                                                                                                        |
| Instance plan     | **$5 USD/month (Nano 3.0)** — 1 GB RAM, 2 vCPU, 40 GB SSD, 2 TB transfer. Free for 3 months on new accounts. If you already used the trial, pick the plan you're willing to pay for; anything under 1 GB will thrash. |
| Instance name     | `strimz`                                                                                                                                                                                                              |

After it's up:

- **Networking** tab → open port `80` (HTTP) to `Anywhere`. Leave everything else closed.
- **Networking** tab → **Attach static IP** so DNS records don't rot on reboot.

## 2 · SSH in and deploy

Download the SSH key from Lightsail (Networking → SSH keys → Download), then:

```bash
chmod 600 ~/Downloads/LightsailDefaultKey-<region>.pem
ssh -i ~/Downloads/LightsailDefaultKey-<region>.pem ubuntu@<static-ip>
```

Inside the instance:

```bash
sudo apt-get update && sudo apt-get install -y git
git clone https://github.com/StrimzLab/Strimz.git strimz
cd strimz
cp infra/lightsail/env.example .env
nano .env          # fill in every secret — see next section
sudo bash infra/lightsail/deploy.sh
```

The first build takes ~5 minutes (Node install + Prisma generate + Go build). Subsequent builds hit the layer cache and finish in seconds.

## 3 · Environment variables

`infra/lightsail/env.example` is the full template. Required secrets:

- `PRIVY_APP_ID` + `PRIVY_APP_SECRET` — from privy.io
- `TURNSTILE_SECRET_KEY` — from Cloudflare (signup bot check)
- `STRIMZ_WEBHOOK_SIGNING_SECRET` + `WEBHOOK_SECRET_ENCRYPTION_KEY` — any 32-byte hex; both services need the **same** values
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` — from resend.com
- `KMS_SOFTWARE_PRIVATE_KEY` — the private key of your relayer EOA (fund from Circle's Arc testnet faucet)
- `SCHEDULER_PRIVATE_KEY` — usually the same private key as the relayer in the demo setup

Placeholders you'll want to point at your real hostname:

- `API_BASE_URL`, `CHECKOUT_ORIGIN`, `CORS_ORIGIN`, `STRIMZ_DASHBOARD_URL`

## 4 · Point your domain at Lightsail (optional)

DNS provider → A-record → your static Lightsail IP.

If you want TLS, install [Caddy](https://caddyserver.com/) or `certbot` on the host and put it in front of port 80 in Docker (change `HTTP_PORT=8080` in `deploy.sh` and run Caddy on 80/443). The nginx inside the container does not terminate TLS — one job, HTTP-in HTTP-out.

## 5 · Day-2 ops

```bash
# Container status + healthcheck
docker ps
docker inspect --format '{{.State.Health.Status}}' strimz

# Live logs (all services interleaved)
docker logs -f strimz

# Per-process state
docker exec -it strimz supervisorctl status
docker exec -it strimz supervisorctl restart api

# Direct DB access
docker exec -it strimz su-exec postgres psql strimz

# Deploy a new build after `git pull`
sudo HTTP_PORT=8080 bash infra/lightsail/deploy.sh
```

## 6 · Backups

Everything worth backing up lives on the `strimz-data` volume. Snapshot it periodically:

```bash
# One-shot tar snapshot into your home dir
docker run --rm \
  -v strimz-data:/data \
  -v ~/backups:/backups \
  alpine sh -c 'tar czf /backups/strimz-$(date +%Y%m%d-%H%M%S).tar.gz -C /data .'
```

Copy the tarball off the box (`scp`, S3, whatever) — Lightsail instances do have automated snapshots too, but they cost extra and snapshot the whole disk.

## 7 · Scaling out later

The single-container shape trades production hygiene for launch speed. When you outgrow it:

- **Split postgres out**: Lightsail Managed DB ($15/mo) or Neon/Supabase. Point `DATABASE_URL` at it.
- **Split redis out**: Upstash Redis free tier is generous for what Strimz uses it for.
- **Split each service into its own container**: move to Docker Compose or ECS. `supervisord.conf` becomes a compose file with almost identical service definitions.

## 8 · Known limits on this shape

- **1 GB RAM** is tight but works. `top` should show us around 800 MB in use.
- **Postgres tuning defaults** (128 MB shared_buffers) are conservative — bump when you have real traffic.
- **No TLS by default** — see step 4.
- **No log rotation** — `docker logs` retains the last 12 MB by default. Add a rotation policy on the daemon (`/etc/docker/daemon.json`) if you're not shipping logs off-box.
- **Container-scoped restart bounces every service.** In a bigger deploy, restarting the scheduler shouldn't take the API down. Solvable by splitting containers.
