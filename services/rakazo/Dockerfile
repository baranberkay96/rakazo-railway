# Rakazo v0.8.0 API and worker for Railway (community template).
# The published upstream image, unchanged, plus a small start wrapper in /opt/rakazo-railway.
# Upstream: https://github.com/elie222/rakazo (Apache-2.0), release v0.8.0 = commit 747ece96.
# Image index digest (linux/amd64 + linux/arm64) checked 2026-11-07.
FROM ghcr.io/elie222/rakazo/app:v0.8.0@sha256:908045c3b393f4d948ea6bed9cd86ab77fd32d467d2fdfa042805b34c5b851ea

# Root only so the wrapper can drop to `node` with a scrubbed environment (see rakazo-railway).
USER root

# --chmod=0755: the directory is new, and BuildKit gives a new parent the same mode.
COPY --chmod=0755 railway/ /opt/rakazo-railway/

# Fail the build early if anything the wrapper relies on moved in the base image.
RUN set -eu; \
    sh -n /opt/rakazo-railway/rakazo-railway; \
    node --check /opt/rakazo-railway/wait-ready.mjs; \
    command -v setpriv >/dev/null; \
    test "$(id -u node)" = 1000; \
    test -d /home/node; \
    test "$(stat -c %U /data)" = node; \
    for f in /app/apps/api/dist/index.js \
             /app/apps/api/dist/cli/migrate-database.js \
             /app/apps/api/dist/cli/bootstrap-owner.js \
             /app/apps/worker/dist/index.js \
             /app/infra/railway/sandbox-environment.mjs; do \
      test -f "$f" || { echo "missing $f in the base image" >&2; exit 1; }; \
    done; \
    grep -q 'environmentCreate' /app/infra/railway/sandbox-environment.mjs; \
    grep -q 'sbx-' /app/infra/railway/sandbox-environment.mjs; \
    grep -q 'DATABASE_MIGRATION_URL' /app/apps/api/dist/cli/migrate-database.js; \
    grep -q 'OWNER_PASSWORD' /app/apps/api/dist/cli/bootstrap-owner.js; \
    for f in /app/apps/api/dist/index.js /app/apps/worker/dist/index.js; do \
      grep -q 'RAILWAY_ENVIRONMENT_ID' "$f"; \
      grep -q 'OBJECT_STORAGE_BUCKET' "$f"; \
    done; \
    grep -q 'TRUSTED_PROXIES' /app/apps/api/dist/index.js; \
    grep -q 'CLIENT_IP_HEADER' /app/apps/api/dist/index.js

ENTRYPOINT ["/opt/rakazo-railway/rakazo-railway"]
CMD ["api"]
