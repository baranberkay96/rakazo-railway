# Rakazo Persistent AI Teammates: Railway template spec

## Listing

| Field | Value |
|---|---|
| Name | **Rakazo Persistent AI Teammates** (`v0.8` from release `v0.8.0`, the pinned build; no third-party product names) |
| Description | Open-source AI teammates with memory, routines and their own computers. (71 chars) |
| Category | AI/ML |
| Tags | rakazo, ai-agents, ai-teammates, computer-use, sandboxes, self-hosted, postgres, grok-bot-alternative |
| Icon | `https://cdn.jsdelivr.net/gh/elie222/rakazo@747ece9641dcc60c95467ffae8ab2311fb1f3f81/apps/web/public/icon-512.png` (upstream app icon at the tag commit, HTTP 200 `image/png`, 512x512) |
| Repo | `baranberkay96/rakazo-railway`, API and Worker build from `/services/rakazo` |

"Their own computers" needs one optional input after deploy (a Railway workspace token, or an E2B/Daytona/Boat key). The README says so in its first section and under Dependencies; chat, memory and routines work without it.

## Feasibility: where bot computers run

Read from `docs/self-host-sandbox-providers.md`, `packages/adapters/src/sandbox-provider-env.ts`, `railway-sandbox.ts` and `infra/railway/*` at v0.8.0:

| Provider | What it is | On Railway |
|---|---|---|
| `docker` (upstream default) | Sibling containers created by a supervisor holding the Docker socket | **Impossible**: no Docker-in-Docker, no privileged containers |
| `kubernetes`, `incus` | Pods / containers on your own cluster | Not applicable |
| `railway` | Railway Sandboxes (isolated VMs) created through the Railway API with `RAILWAY_API_TOKEN` in the environment `RAILWAY_ENVIRONMENT_ID`, `PRIVATE` networking, a public domain on port 6080 for the screen (token-protected gateway) | **Works**, upstream's own Railway choice. Billed to the user's Railway usage. Must run in a separate, empty environment: a `PRIVATE` sandbox joins its environment's private network |
| `e2b`, `daytona`, `boat`, `novita`, `boxd`, `createos` | Hosted sandboxes, outbound HTTPS only | **Works** with the provider's key, billed by the provider |
| `none` | No computers | What `railway` falls back to when no token is set; chat, memory, routines, connected apps keep working |

Verdict: **feasible**. Default deploy = `SANDBOX_PROVIDER=railway` without a token = computers off, everything else on. Adding the token (or another provider's key) turns computers on without other changes.

## Base market templates and improvements

| Market template | What it does | Problems |
|---|---|---|
| "Rakazo Template" (29 active) = upstream's `infra/railway` (fork `GDemay/rakazo`, branch `railway-template`) | One service builds the monorepo from source and runs API + worker + web with tini; `/data` volume; `postgres:16.13`; computers on Railway | Source build of an unpinned branch (slow, changes under users); `RAILWAY_API_TOKEN` and `OWNER_EMAIL` both required, so it cannot deploy without granting a token; single `DATABASE_URL` = owner login, so row-level security is not enforced (upstream warns); `RAILWAY_RUN_UID=0`; restart `ON_FAILURE` ×5; one container for three processes |
| "Rakazo" (8 active, `monotykamary/railway-template-rakazo`, Apache-2.0) | `web` image v0.3.3 + `api`/`worker` built from a setpriv wrapper; `postgres-ssl:18` | Five releases old; **open sign-up** (`SIGNUPS_ENABLED=true`): anyone who finds the URL gets an account on the operator's model and sandbox keys; `api` and `worker` each get their **own** `/data` volume although upstream requires a shared one (bot homes and files split between processes); migrations with bare `prisma migrate deploy` (no job queue schema, no RLS login); API bound to `0.0.0.0`; no web healthcheck |
| "Rakazo Suite" (3 active) | `:edge` images (moving), web/api/worker split | Unpinned images; `DATA_DIR=/tmp` without object storage (homes and files lost on redeploy and not shared); malformed `BETTER_AUTH_SECRET` reference on the worker; open sign-up; suggests sleeping the API, which stops routines |

Improvements in this template:
1. **Pinned v0.8.0** published image by index digest for all three app services; no source build (Web uses the image as is; API/Worker add two small scripts on top).
2. **Upstream's production topology** (compose `migrate`/`api`/`worker`/`web`): separate Web, API and Worker services, each with its own restarts, logs, memory and drain time.
3. **Shared state without shared volumes**: upstream's object storage mode (`OBJECT_STORAGE_*`) on a Railway Bucket holds bot homes and files, encrypted before upload; `DATA_DIR` is only a cache. API and Worker need no volume, and the worker can scale out.
4. **Row-level security on**: migrations run as the owner in the API's pre-deploy step, which also creates the `rakazo_app` login; the API and worker connect as `rakazo_app` and never see the owner URL.
5. **Private by default**: owner account created before the app is reachable, sign-up closed, only Web public, API bound to `::` on the private network, Postgres private.
6. **Computers optional, safe and documented**: no token required to deploy; with a token, computers always land in a separate `sbx-` environment (wrapper refuses the app's own environment and falls back to "computers off" on any doubt); token scope, risk and costs written out.
7. Client addresses correct behind two proxies (`TRUSTED_PROXIES` = the Web service, `CLIENT_IP_HEADER=x-real-ip`), so sign-in rate limits are per visitor.
8. Worker waits for the API (schema ready) and drains up to 45 minutes like upstream's compose; restart `ALWAYS` everywhere except Postgres.

## Pinned versions

| Component | Reference | Version / date | Checked |
|---|---|---|---|
| Rakazo app image | `ghcr.io/elie222/rakazo/app:v0.8.0@sha256:908045c3b393f4d948ea6bed9cd86ab77fd32d467d2fdfa042805b34c5b851ea` (OCI index; amd64 `sha256:bd8658b0…`, arm64 `sha256:54ab3e99…`) | release v0.8.0, commit `747ece96` (= label `org.opencontainers.image.revision`), image built 2026-11-04 | 2026-11-07 |
| Postgres | `ghcr.io/railwayapp-templates/postgres-ssl:18` | Railway base service (tag, as in `_railway-base/postgres.json`) | 2026-11-07 |

`v0.8`, `v0.8.0` and `latest` all pointed at the same index on 2026-11-07. Image config: user `node` (uid 1000), `WORKDIR /app`, `NODE_ENV=production`, `GIT_SHA=747ece96…`, Node 24.22.1 on Debian bookworm, `/data` owned by `node` (0750), no `VOLUME`. Rakazo is in beta and releases often (0.6.0, 0.7.0 and 0.8.0 on the same day).

## Architecture

```
Browser / desktop / mobile app ──HTTPS──► Railway edge (sets X-Real-IP)
   └─► Web  (public, :5173, image as is)  vite preview: static app, /novnc screen proxy
         │  /api, /rpc, /.well-known/{apple-app-site-association,assetlinks.json}
         ▼  http://api.railway.internal:3100   (private network)
       API  (private, [::]:3100)  sign-in, chat runs, computers   ──┐
       Worker (private)  routines, wake-ups, background runs, GC  ──┤── Postgres (private, volume)
                                                                    ├── Bucket (homes, files; encrypted)
                                                                    └── computers:
            SANDBOX_PROVIDER=railway + token ─► Railway API ─► environment "sbx-<24 hex>" in this project
                                                  (one VM per computer, PRIVATE network of that empty env,
                                                   screen on https://<id>.up.railway.app, token-protected)
            or E2B / Daytona / Boat over HTTPS
```

## Services

### Web
| Setting | Value |
|---|---|
| Source | image `ghcr.io/elie222/rakazo/app:v0.8.0@sha256:908045c3…` |
| Start | `/bin/sh -c 'cd /app/apps/web && exec node_modules/.bin/vite preview --host :: --port "${PORT:-5173}"'` (upstream compose's command; `::` = dual stack) |
| Healthcheck | `GET /` on `PORT=5173`, 300 s. `RAKAZO_ALLOWED_HOSTS=healthcheck.railway.app` (upstream's Railway Dockerfile sets the same) |
| Domain | public, target port 5173 |
| Variables | `RAKAZO_HOST` (public hostname), `API_PROXY_TARGET` (API private URL), `SCREEN_PROXY_SECRET` (from API), `RAYON_NUM_THREADS=4` (upstream compose), `RAKAZO_IMAGE_TAG`, draining 30 s |

The web server gets no database, auth, encryption or Railway credentials.

### API
| Setting | Value |
|---|---|
| Source | repo `baranberkay96/rakazo-railway`, `/services/rakazo` (Dockerfile: `FROM` the pinned digest, `USER root`, wrapper in `/opt/rakazo-railway`, build-time checks) |
| Pre-deploy | `/opt/rakazo-railway/rakazo-railway predeploy`, timeout 1200 s: wait for Postgres (TCP, ≤600 s) → `dist/cli/migrate-database.js` as owner (Prisma migrations, job queue schema, `rakazo_app` login; 5 tries) → `dist/cli/bootstrap-owner.js` without the owner URL (3 tries). Fails the deploy if any step fails |
| Start | `/opt/rakazo-railway/rakazo-railway api` → resolve computers → scrub → `exec setpriv` to `node` → `node dist/index.js` in `/app/apps/api` |
| Healthcheck | `GET /ready` (DB reachable, secret store not degraded) on `PORT=3100` = `API_PORT`, 600 s |
| Domain | none. `API_HOST=::` |
| Restart | `ALWAYS`; draining 120 s |

Required input: `OWNER_EMAIL`. Generated: `OWNER_PASSWORD` (32), `RAKAZO_DB_APP_PASSWORD` (32 hex), `ENCRYPTION_KEY` (64 hex), `BETTER_AUTH_SECRET` (64), `SCREEN_PROXY_SECRET` (64). Wired: `DATABASE_URL` (rakazo_app), `DATABASE_MIGRATION_URL` (= `Postgres.DATABASE_URL`), `RAKAZO_PUBLIC_ORIGIN` → `BETTER_AUTH_URL`/`WEB_ORIGIN`/`API_URL`, `TRUSTED_PROXIES=${{Web.RAILWAY_PRIVATE_DOMAIN}}`, `CLIENT_IP_HEADER=x-real-ip`, `OBJECT_STORAGE_*` = Bucket (virtual-hosted), `CONTENT_ENCRYPTION=on`, `SIGNUPS_ENABLED=false`, `AGENT_RUNTIME=pi`, `WAKEUP_DRIVER=graphile`. Computers: `SANDBOX_PROVIDER=railway`, `RAILWAY_API_TOKEN` (empty), `RAILWAY_SANDBOX_REGION`, `RAILWAY_SANDBOX_ENVIRONMENT_ID` (advanced), `E2B_API_KEY`, `DAYTONA_API_KEY`, `BOAT_API_KEY`, `SANDBOX_IDLE_MS=600000`, `COMPUTER_MAX_ACTIVE_MS=7200000`, `SANDBOX_MAX_COMPUTERS_PER_USER=3`. Optional: `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, `PI_DEFAULT_PROVIDER`, `PI_DEFAULT_MODEL`, `COMPOSIO_API_KEY`, `EMAIL_PROVIDER`/`EMAIL_API_KEY`/`EMAIL_FROM` (Resend HTTP API; SMTP is Pro-only on Railway), `LOG_LEVEL`.

### Worker
Same repo and image as the API. Start `/opt/rakazo-railway/rakazo-railway worker`: waits up to 900 s for `RAKAZO_API_READY_URL` (`http://api.railway.internal:3100/ready`; the API only listens after its pre-deploy migrated the schema), then the same computer resolution and scrub, then `node dist/index.js` in `/app/apps/worker`. No healthcheck (upstream's worker health is a file check, no port). Restart `ALWAYS`, `RAILWAY_DEPLOYMENT_DRAINING_SECONDS=2700` (upstream: `JOB_DRAIN_TIMEOUT_MS` 45 min, compose `stop_grace_period: 50m`; the drain ends as soon as running jobs finish). Every shared setting references the API (`${{API.X}}`), so it is changed in one place.

### Postgres and Bucket
Postgres from `_railway-base/postgres.json` unchanged (no extensions needed; upstream runs 16 in compose and 18 in its topology test). Bucket `Bucket` for `OBJECT_STORAGE_*` on API and Worker.

## Start wrapper (`services/rakazo/railway/rakazo-railway`)

| Step | Behaviour |
|---|---|
| Privileges | Starts as root (image `USER root`, Railway's init is PID 1 and root). Every Rakazo process, the wait helper and upstream's environment script run as `node` through `setpriv --reuid=node --regid=node --init-groups --no-new-privs`, `HOME=/home/node`; final process is `exec`'d (gets SIGTERM directly). `umask 077`. |
| Scrub | Before `exec`: `DATABASE_MIGRATION_URL`, `OWNER_PASSWORD`, `OWNER_EMAIL` removed; empty optional keys removed (so "" never counts as configured); `RAILWAY_API_TOKEN` removed unless the Railway provider is active. PID 1's environment is root-only, so `node` cannot read the originals from `/proc/1/environ`. |
| Ports | API: `API_PORT` defaults to `PORT`, must equal it (healthcheck); `API_HOST` defaults to `::`. |
| Computers | `SANDBOX_PROVIDER≠railway` → token dropped. `railway` without token → `SANDBOX_PROVIDER=none`. With token: `RAILWAY_SANDBOX_ENVIRONMENT_ID` if set, else upstream's `/app/infra/railway/sandbox-environment.mjs` (lists the project's environments, finds or creates `sbx-<sha256(seed:appEnvId)[:24]>` without copying services) with seed = `RAILWAY_PROJECT_ID` (or `RAKAZO_SANDBOX_SCOPE`), so API and Worker resolve the same environment; 3 tries, then one more lookup so two simultaneous creators converge on the first listed environment. The id must be a UUID and differ from the app's own `RAILWAY_ENVIRONMENT_ID`; it then replaces `RAILWAY_ENVIRONMENT_ID` for the Rakazo process. Any failure → computers off (`none`, token removed), logged as an error, the app still starts. |
| Roles | `predeploy`, `api`, `worker`; anything else exits 1. Its own path as first argument is ignored (in case Railway passes the start command to the entrypoint). |

## Security model

- **Public surface**: Web only. Without a session: static app, sign-in, `/.well-known/*` passthrough, shared pages by link (`/p/...`), messaging webhooks the operator configures. Everything else needs a session. `/health`, `/ready` and `/internal/health` are not routed publicly.
- **Accounts**: one verified owner account created from `OWNER_EMAIL`/`OWNER_PASSWORD` in pre-deploy (upstream's private bootstrap; "an ordinary verified account ... with no server privileges"); `SIGNUPS_ENABLED=false` re-applied on every start. Upstream has no admin role and no first-user privilege. Changing `OWNER_PASSWORD` later does nothing to an existing verified account; a new `OWNER_EMAIL` creates another account.
- **Database**: API/Worker use `rakazo_app` (NOSUPERUSER, NOBYPASSRLS, only app-table grants); owner URL only in pre-deploy.
- **Railway token** (when set): a workspace token can do anything in its workspace (read every variable of every project, create/delete services, environments, volumes, deployments, sandboxes billed to the workspace). Rakazo uses it for: list environments, create one `sbx-` environment, and `Sandbox.create/connect/exec/heartbeat/destroy` plus file transfer in that environment (read in `railway-sandbox.ts`). It lives in the API's variables (Worker references them), in those two processes' memory, never in Web or in computers (the SDK call carries the token only as API authentication; commands in a computer get cache paths plus the variables a run asks for, such as bot secrets, never the server's environment). Exposure paths: anyone with project access, or a compromise of the API/Worker process. Recommendation: dedicated workspace for this project, revoke on removal. Account tokens (all workspaces) discouraged; project tokens cannot work (`Project-Access-Token` header, single environment, cannot create environments).
- **Computers**: separate environment, so no route to Postgres/API; each bot's screen behind the desktop gateway's per-screen tokens; idle stop after 10 min, uptime cap 2 h, 3 per user.
- **Bots**: act with the owner's model keys, connected apps and computers; approvals in Settings → Approvals (spaces start in Auto, which asks until an approval model is set). Stdio MCP servers stay off (upstream default).
- **Data at rest**: content encryption on; Bucket holds ciphertext only; `ENCRYPTION_KEY` must be backed up outside Railway.

## First login

1. Deploy with `OWNER_EMAIL`. First build of API and Worker pulls the 1.3 GB image (a few minutes).
2. Web healthy → open its domain → sign in with `OWNER_EMAIL` and `OWNER_PASSWORD` (API → Variables). Change the password in account settings.
3. Settings → Models: sign in with ChatGPT/Claude or add an API key (or set `OPENROUTER_API_KEY` on API).
4. Message a bot. Optional: set `RAILWAY_API_TOKEN` on API, deploy API + Worker, open a bot's computer.

## Resource estimate

Railway prices: RAM $10/GB-month, vCPU $20/vCPU-month, volume $0.15/GB-month, Bucket $0.015/GB-month, sandboxes $50/GB-month memory + $50/vCPU-month used. Not measured (no container run); from upstream's compose memory limits (web 512 MB, api 2 GB, worker 2 GB) and upstream's own Railway estimate (whole app ≈ 1 GB + 0.1 vCPU).

| Service | Idle RAM / CPU | Typical RAM / CPU | Notes |
|---|---|---|---|
| Web | 0.15–0.25 GB / ~0.01 | 0.25 GB / 0.02 | Vite preview + screen proxy |
| API | 0.3–0.45 GB / 0.02 | 0.5–0.9 GB / 0.1 | chat turns run here |
| Worker | 0.25–0.4 GB / 0.02 | 0.4–0.8 GB / 0.1 | routines, background runs |
| Postgres | 0.1–0.15 GB / 0.01 | 0.2–0.3 GB / 0.03 | volume 0.3–2 GB |
| Bucket | — | 1–5 GB stored | homes, files |
| Railway computer | 0 (destroyed when stopped) | ~2.5 GB / 0.5 vCPU while running | ≈ $0.21/h; 88 h/month ≈ $18; 24/7 ≈ $150 |

App total: **idle ≈ $10/month** (≈0.9 GB, 0.06 vCPU), **typical ≈ $20–25/month** (1.5–2 GB, 0.25 vCPU), plus computers and models. Minimum plan: **Hobby** (Trial sandboxes have a forced 1–5 min idle timeout that can destroy a computer before its files are saved; $5 Trial credit would not last a month).

## Verification results (2026-11-07, static only; no Docker, not deployed)

| Check | Result |
|---|---|
| GHCR: `v0.8.0` tag → index `908045c3…`, amd64/arm64 manifests, config (user, env, revision label = tag commit `747ece96`), build history | as pinned; `latest`/`v0.8` = same index |
| GitHub: tag `v0.8.0` → `747ece96`; release published 2026-11-04; 48 cited upstream files byte-identical to the local copy | pass |
| Image layers (digest-verified downloads): base layer has `/usr/bin/setpriv`; source layer has `infra/railway/sandbox-environment.mjs` (identical to the repo); build layer has `apps/api/dist/{index.js,cli/migrate-database.js,cli/bootstrap-owner.js}`, `apps/worker/dist/index.js`; `/data` owned 1000:1000 | pass |
| Dockerfile `RUN` body: `sh -n`/`dash -n`/`bash -n`; file and string checks replayed against the extracted layers | pass (`setpriv`, `id node`, `/home/node`, `/data` owner checked from layers/history instead) |
| `rakazo-railway`: `sh -n`, `dash -n`, `bash -n`; 21 tests (stub entry points, a self-written stand-in for upstream's environment script, fake Postgres/API listeners) incl. scrubbing, empty keys, token-less boot, environment resolution and refusal cases, race convergence, scope override, port rules, pre-deploy order/retries/failures, worker wait | 21/21 pass (also under dash and bash) |
| `wait-ready.mjs`: `node --check`; 6 tests (URL parsing without credentials, timeout, argument errors, no secret in logs) | 6/6 pass |
| `template.json`: JSON parse, every `${{Service.VAR}}` resolves, healthchecked services set `PORT` = target, one required input, `_tools/to_serialized.py` converts (4 services + Bucket) | pass |
| README 8.2k chars, Rule 5 headings, no `<placeholders>`; all links and icons 200 | pass |
| Docker build, container run, Railway behaviour | **not run** |

## Verification checklist

- [ ] Build logs (API, Worker): `FROM …@sha256:908045c3…` pulled, RUN checks pass.
- [ ] API pre-deploy log: `waiting up to 600 s for postgres.railway.internal:5432` → `Runtime login is ready (member of rakazo_app)` → `Account verified` → `pre-deploy done`.
- [ ] API deploy log: `computers: off until RAILWAY_API_TOKEN is set …`, `starting the Rakazo API on [::]:3100`, healthy on `/ready`. Worker: `api.railway.internal:3100/ready is ready`, then running; Web healthy on `/`.
- [ ] `curl -I https://{domain}/` 200; `curl https://{domain}/health` is the web app, not the API; sign-up form refused; sign in with `OWNER_EMAIL`/`OWNER_PASSWORD` works.
- [ ] Connect a model, chat with a bot, create a routine (runs in the worker), upload an attachment and reload it after redeploying API and Worker (Bucket).
- [ ] `railway ssh` into API: `node -e "fetch('http://127.0.0.1:3100/internal/health').then(r=>r.text()).then(console.log)"` shows `sandbox: none`; `tr '\0' '\n' < /proc/$(pgrep -f 'dist/index.js')/environ | grep -c -E 'DATABASE_MIGRATION_URL|OWNER_PASSWORD'` → 0; process user `node`.
- [ ] Postgres: `\du` shows `rakazo_app` without superuser/bypassrls.
- [ ] Sign-in rate limit: several wrong passwords from two networks lock only one (client address = visitor, not the Web service).
- [ ] With a workspace token on API, redeploy API + Worker: one `sbx-…` environment appears in the project, both services log the same environment id; a bot's computer opens with a live screen; from the computer, `postgres.railway.internal` does not resolve/connect; stopping (10 min idle) destroys the sandbox and the next start restores the files.
- [ ] Invalid token: both services log `Railway computers are OFF`, chat still works.
- [ ] Redeploy: account, bots, chats, routines, files persist.

## Open questions

- **Never built or run.** Most likely failure points: Railway applying the start/pre-deploy commands to the wrapper image as expected; `setpriv --init-groups` under Railway's runtime; Vite preview on `::` behind Railway's edge (upstream's Railway setup uses `0.0.0.0`); first-boot timing (300/600 s healthcheck windows are estimates).
- **Object storage across services**: upstream documents that with `OBJECT_STORAGE_BUCKET` the API and worker "no longer need a shared disk", and its compose files still mount one `/data`. This split was not exercised: the Railway Bucket (virtual-hosted, region `auto`) with Rakazo's S3 client, home save/restore between API and Worker, large-home staging on ephemeral disk.
- **Cross-service references**: `TRUSTED_PROXIES` as a hostname is resolved by the API (upstream supports hostnames); if Railway's private addresses do not match the resolved records, all visitors share one rate-limit bucket (nothing becomes less secure).
- **Railway sandboxes**: duplicate `sbx-` environments if API and Worker create at the same instant (mitigated by the second lookup; harmless empty environment at worst); Railway environment-name uniqueness not verified; sandbox region names; behaviour on Trial.
- **Upstream pace**: three releases on 2026-11-04 and a beta label; migrations may need care between versions (`CHANGELOG.md`, `docs/self-host-upgrading.md`).
- RAM figures and sandbox costs are estimates from upstream's own numbers.
