# NOTICE: Rakazo template

This is a community template. It is not affiliated with or endorsed by the Rakazo project or its contributors, Railway, E2B, Daytona, Boat, Composio, Resend, OpenRouter, Anthropic or OpenAI.

## Software deployed

| Component | Source | License | How it is used |
|---|---|---|---|
| Rakazo | https://github.com/elie222/rakazo, release `v0.8.0` = commit `747ece9641dcc60c95467ffae8ab2311fb1f3f81` (2026-11-04); image `ghcr.io/elie222/rakazo/app:v0.8.0@sha256:908045c3b393f4d948ea6bed9cd86ab77fd32d467d2fdfa042805b34c5b851ea` | Apache License 2.0, Copyright 2026 Rakazo contributors | Web runs the published image unchanged. API and Worker build `FROM` the same digest and only add `/opt/rakazo-railway/` (two scripts written for this template). Third-party software inside the image (Node.js, Debian packages, npm dependencies such as Railway's `railway` SDK, MIT) keeps its own licenses. |
| Upstream Railway helper | `infra/railway/sandbox-environment.mjs`, shipped inside the same image | Apache License 2.0 (part of Rakazo) | Executed from the image at start to find or create the separate `sbx-...` sandbox environment. Not copied into this repository. |
| PostgreSQL | `ghcr.io/railwayapp-templates/postgres-ssl:18` (Railway's Postgres image) | PostgreSQL License | Used unchanged, service definition from Railway's base template. |
| Icons | Rakazo `apps/web/public/icon-512.png` at the pinned commit; Lucide `server.svg`, `workflow.svg` (`lucide-static@1.59.0`); Railway devicons | Rakazo icon: part of the Apache-2.0 repository; Lucide: ISC | Loaded by URL, not redistributed. |

Rakazo's name and icon identify the software this template deploys, unchanged. The Apache License 2.0 grants no trademark rights (section 6); no endorsement is implied. The README compares Rakazo with other products only in the words upstream uses for itself.

## Template files

All files in this repository were written for this package: `TEMPLATE.md`, `template.json`, `README.md`, this NOTICE, `services/rakazo/Dockerfile`, `services/rakazo/railway/rakazo-railway` and `services/rakazo/railway/wait-ready.mjs`. No upstream file or text was copied into them.

Ideas taken, re-written rather than copied:
- From upstream's own Railway setup (`infra/railway/start.sh`, `README.md`, `Dockerfile` at v0.8.0, Apache-2.0): migrate as the database owner and start the app without the owner URL; create the owner account privately with `dist/cli/bootstrap-owner.js` and keep sign-up closed; run Railway computers in a separate, empty environment; read the client address from `X-Real-IP`; allow `healthcheck.railway.app` on the web server; keep the Railway token away from the web process.
- From `monotykamary/railway-template-rakazo` (the "Rakazo" market template, Apache License 2.0): running the published image as `node` through a small `setpriv` wrapper. Its files were not copied; this template needs no volume ownership change.

Apache License 2.0 text: https://github.com/elie222/rakazo/blob/v0.8.0/LICENSE

## Upstream files checked (tag `v0.8.0`, checked 2026-11-07)

The local copy in `_upstream/elie222__rakazo` was compared file by file with the tag through the GitHub API (identical for every file below).

- Deployment: `railway.json`, `infra/railway/{Dockerfile,start.sh,sandbox-environment.mjs,README.md}`, `infra/compose/{docker-compose.images.yml,docker-compose.prod.yml,docker-compose.topology.yml,Dockerfile.topology,Caddyfile.prod}`, `.env.example`
- Documentation: `README.md`, `CHANGELOG.md` (0.6.0 to 0.8.0), `docs/self-host.md`, `docs/self-host-production.md`, `docs/self-host-configuration.md` (database roles, connections, memory), `docs/self-host-accounts.md`, `docs/self-host-storage.md` (object storage for homes and files), `docs/self-host-sandbox-providers.md`, `docs/self-host-upgrading.md`, `docs/self-host-models.md`, `docs/models.md`, `docs/getting-started.md`, `docs/computer-runtime.md`
- Source: `apps/api/src/{env.ts,index.ts,health.ts,client-ip.ts,cli/bootstrap-owner.ts,cli/migrate-database.ts}`, `apps/web/{vite.config.ts,src/api-proxy.ts}`, `apps/worker/src/index.ts`, `packages/adapters/src/{railway-sandbox.ts,railway-settings.ts,sandbox-provider-env.ts,sandbox-factory.ts,computer-provider-descriptor.ts,s3-object-storage.ts,artifact-store-factory.ts,home.ts,deployment-model.ts,mcp-package-installer.ts}`, `packages/db/src/database-access.ts`, `packages/core/src/secrets-guard.ts`, `apps/www/src/sandboxes/{railway.ts,shared.ts}` (upstream's own Railway cost model)
- Image: GHCR index and linux/amd64 manifest and config for the pinned digest (user `node`, entrypoint, revision label = tag commit, build history). The layers holding the source tree, the API/worker build output and `/data` were downloaded, digest-checked and listed to confirm every path and string the Dockerfile checks; the base layer was listed to confirm `setpriv`. Nothing from them is redistributed.

## Market templates reviewed (Railway marketplace, 2026-11-07)

- "Rakazo Template" (29 active projects): upstream's own Railway layout, built from a fork's branch (`GDemay/rakazo`, `railway-template`).
- "Rakazo" (8 active): `monotykamary/railway-template-rakazo`, image v0.3.3, Apache-2.0.
- "Rakazo Suite" (3 active): `:edge` images, no repository.

Their configurations were read for comparison; differences are listed in TEMPLATE.md.
