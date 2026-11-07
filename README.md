# Deploy and Host Rakazo with Railway

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/rakazo-v08-persistent-ai-teammates?referralCode=20H68q)

Rakazo is an open-source, self-hosted AI agent for persistent teammates: bots with their own chats, memory, routines and computers, on the model you choose. This community template runs Rakazo v0.8.0 from the official images as separate web, API and worker services with Postgres and a Railway Bucket, private from the first minute.

## About Hosting Rakazo

Rakazo is a long-running app, not a static site. The API runs chat turns, the worker runs routines and background jobs, the web server serves the app and forwards API calls, and Postgres holds everything plus the job queue. Bots can also get a computer (Linux desktop, browser, terminal, files) from a sandbox provider. Railway cannot run Docker computers, so this template uses upstream's remote providers: Railway sandboxes in your own project, or E2B, Daytona or Boat. Without one, Rakazo still boots and chat works. Your account exists before the app goes online, public sign-up is closed, and only the web service is public.

## Common Use Cases

- A personal assistant that remembers context and runs routines, such as a weekday morning inbox summary
- Bots that browse, research and edit files on their own Linux computer, with live screen and takeover
- Coding and operations helpers that run commands in an isolated sandbox instead of on your laptop
- Agents working in Gmail, Slack, GitHub and other apps through Composio
- One server for Rakazo's web, desktop and mobile apps

## Dependencies for Rakazo Hosting

- A model: after signing in, connect a ChatGPT or Claude subscription or an API key in **Settings → Models**, or set `OPENROUTER_API_KEY` / `ANTHROPIC_API_KEY` on the API service. Model usage is billed by that provider.
- Optional, for bot computers: a Railway workspace token (computers run as Railway sandboxes in this project, billed to your Railway usage), or an E2B, Daytona or Boat key (billed by them).
- Optional: a Composio key for connected apps, a Resend key for password-reset email.

### Deployment Dependencies

- Rakazo (Apache-2.0): https://github.com/elie222/rakazo
- Release v0.8.0: https://github.com/elie222/rakazo/releases/tag/v0.8.0
- Image: https://github.com/elie222/rakazo/pkgs/container/rakazo%2Fapp
- Self-hosting: https://github.com/elie222/rakazo/blob/v0.8.0/docs/self-host.md
- Computer providers: https://github.com/elie222/rakazo/blob/v0.8.0/docs/self-host-sandbox-providers.md
- Railway sandboxes: https://docs.railway.com/sandboxes
- Railway API tokens: https://docs.railway.com/integrations/api

### Implementation Details

| Service | Source | Role |
|---|---|---|
| Web | `ghcr.io/elie222/rakazo/app:v0.8.0` (digest-pinned) | Public web app; forwards `/api` and `/rpc` to the API over the private network. Healthcheck `/` |
| API | same image + a small start wrapper | Sign-in, chat runs, computers. Private only. Pre-deploy: migrations and owner account. Healthcheck `/ready` |
| Worker | same image + wrapper | Routines, wake-ups, background runs, cleanup. Private, waits for the API |
| Postgres | Railway Postgres 18 | Data and job queue, volume |
| Bucket | Railway Bucket | Bot computer homes and files, encrypted before upload |

The API and worker have no volume: what they share lives in Postgres and the Bucket, so the worker can scale out.

**First login**

1. Enter your email in `OWNER_EMAIL` and deploy. The first build takes a few minutes.
2. When Web and API are healthy, open the Web domain.
3. Sign in with that email and `OWNER_PASSWORD` from the API service's Variables tab. Change the password in account settings; editing the variable later does not reset it.
4. Connect a model in **Settings → Models** and message your first bot.

Nobody else can register (`SIGNUPS_ENABLED=false`). To invite people, set up email (`EMAIL_PROVIDER=resend`, `EMAIL_API_KEY`, `EMAIL_FROM`) then add `SIGNUP_ALLOWLIST` (emails or `@domain`) and set `SIGNUPS_ENABLED=true` on the API.

**Bot computers on Railway (optional)**

1. Create a **workspace** token at https://railway.com/account/tokens, ideally for a workspace that holds only this project.
2. Set it as `RAILWAY_API_TOKEN` on the API service (`SANDBOX_PROVIDER` is already `railway`) and deploy the staged changes for API and Worker.
3. On start, the API finds or creates one empty environment named `sbx-...` in this project and runs every computer there, never in the app's environment, so a computer cannot reach Postgres or the API. Open a bot's computer to start one.

What the token can do: a workspace token has full API access to every project in that workspace. It can read all their variables, create, change or delete services, environments and volumes, and start resources billed to the workspace. Rakazo uses it only to find or create the `sbx-` environment and to create, inspect, run commands in, copy files to and from, and delete sandboxes there. It is kept on the API and Worker, never given to the Web service or to the computers. Anyone with access to this Railway project can read it. Account tokens reach all your workspaces, so avoid them. Project tokens do not work. Revoke the token when you remove the project, and check the `sbx-` environment for leftover computers.

Cost: Railway bills sandboxes at virtual machine rates, $50 per GB-month of memory held and $50 per vCPU-month used, per second. A desktop with Chromium at about 2.5 GB and 0.5 vCPU costs roughly $0.21 per hour while running, about $18 a month at 4 hours per workday. Computers stop after 10 idle minutes (`SANDBOX_IDLE_MS`) and after 2 hours of continuous running unless in use (`COMPUTER_MAX_ACTIVE_MS`). Each user may have 3 (`SANDBOX_MAX_COMPUTERS_PER_USER`). Use Hobby or Pro: Trial sandboxes have a 1 to 5 minute idle timeout that can end a computer before its files are saved.

Other providers: set `SANDBOX_PROVIDER` to `e2b`, `daytona` or `boat` and the matching key on the API. The worker follows the API's settings.

**Security**

- Only Web is public. The API, worker and Postgres are private. Bucket objects are encrypted with keys derived from `ENCRYPTION_KEY`.
- The API and worker connect as `rakazo_app`, a login under row-level security. The database owner URL is used only in the pre-deploy step and removed before the API starts. Both run as the image's unprivileged user.
- Content is encrypted at rest (`CONTENT_ENCRYPTION=on`). Back up `ENCRYPTION_KEY` outside Railway: without it the data cannot be read, and changing it breaks stored data.
- Bots act with your accounts, keys and connected apps. Review **Settings → Approvals** before giving them sensitive access.

**Custom domain**: attach it to Web, set `RAKAZO_HOST` on Web to the hostname and `RAKAZO_PUBLIC_ORIGIN` on the API to `https://{your-domain}`, then redeploy Web, API and Worker. Passkeys follow the domain.

**Scaling**: give API and Worker more memory for many parallel chats and routines (chat runs execute in the API, routines in the worker). The worker can run several replicas. Keep one API replica unless you have tested more.

**Pinning and upgrades**: Web and the API/worker Dockerfile pin `v0.8.0` by digest. To upgrade, read upstream's changelog, back up Postgres and `ENCRYPTION_KEY`, change the tag and digest in both places, and redeploy. Migrations run in the API's pre-deploy step before the new version starts, and the worker gets up to 45 minutes to finish running jobs.

**Costs (estimate)**: Web, API, worker and Postgres idle at about 0.9 GB RAM (about $10 a month) and typically use 1.5 to 2 GB (about $20 to $25) at Railway's usage prices. The Bucket costs $0.015 per GB-month. Computers and models are extra, as above. Hobby plan or higher.

### Why Deploy Rakazo on Railway?

Bots that run routines and keep memory need an always-on server, a database and HTTPS. On Railway that is one deploy with private networking, logs and restarts, and with a workspace token the bots' computers run in the same project and on the same bill, without a Docker host or another sandbox account.
