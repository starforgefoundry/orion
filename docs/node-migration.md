# Node + Postgres + Local Disk Migration

Move Orion off Cloudflare Workers/D1/R2 onto a Node server, Postgres, and local disk storage.

## Current State

| Concern         | Now                                                     | Target                                           |
| --------------- | ------------------------------------------------------- | ------------------------------------------------ |
| Runtime         | `@sveltejs/adapter-cloudflare`, `wrangler.jsonc`        | `@sveltejs/adapter-node`                         |
| DB              | D1 via `drizzle-orm/d1`, built per request in `getDB()` | Postgres via `drizzle-orm/postgres-js`, one pool |
| Object storage  | R2 via `s3mini`, public URL from `S3_PUBLIC_URL`        | Files under `STORAGE_DIR`, served by the app     |
| Background work | `platform.ctx.waitUntil`                                | Plain promise with error logging                 |
| Migrations      | `wrangler d1 migrations apply`                          | `drizzle-kit migrate` on deploy                  |
| Deploy          | GitHub Action → `wrangler deploy`                       | GitHub Action → OCI image on GHCR → Kubernetes   |

## Worker Workarounds to Remove

| #   | Where                                                                                                                                                                                                                                                                                                                                               | Why it exists                                                         | Change                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | [patches/@sveltejs\_\_kit@2.50.2.patch](../patches/@sveltejs__kit@2.50.2.patch)                                                                                                                                                                                                                                                                     | workerd allows one pending stream read; `LazyFile.stream()` rewritten | Delete patch and its `patchedDependencies` entry in [pnpm-workspace.yaml](../pnpm-workspace.yaml)   |
| 2   | [pnpm-workspace.yaml](../pnpm-workspace.yaml) `allowBuilds.workerd`                                                                                                                                                                                                                                                                                 | wrangler dep                                                          | Remove with `wrangler`                                                                              |
| 3   | [print_request.service.ts:18-23](../src/lib/server/services/print_request.service.ts#L18-L23)                                                                                                                                                                                                                                                       | Files uploaded in `waitUntil` after the response                      | Write files to disk before returning. Reading the request body after the response is unsafe on Node |
| 4   | [s3.ts](../src/lib/server/utils/s3.ts) `Buffer.from(await file.arrayBuffer())` + `pRetry`                                                                                                                                                                                                                                                           | s3mini needs a buffer; R2 flakiness                                   | Stream `file.stream()` to disk with `stream/promises.pipeline`. Drop `pRetry`, `p-retry`, `s3mini`  |
| 5   | `waitUntil` in [print_payment.service.ts:454](../src/lib/server/services/print_payment.service.ts#L454), [print_request.service.ts:69](../src/lib/server/services/print_request.service.ts#L69), [class.service.ts:338](../src/lib/server/services/class.service.ts#L338), [class.service.ts:689](../src/lib/server/services/class.service.ts#L689) | Keep isolate alive after response                                     | Hoist `runInBackground` from `class.service.ts` into a shared util; use it at all call sites        |
| 6   | [class.repository.ts:62](../src/lib/server/repositories/class.repository.ts#L62) `chunk(data, 3)`                                                                                                                                                                                                                                                   | D1 100 bound-param limit                                              | Single insert inside a transaction                                                                  |
| 7   | [print_files.service.ts](../src/lib/server/services/print_files.service.ts) ZIP download                                                                                                                                                                                                                                                            | Fetches each file over HTTP from R2, builds Blob in memory            | Read from disk; stream the ZIP (`generateNodeStream`)                                               |
| 8   | [app.d.ts](../src/app.d.ts) `Platform`, [worker-configuration.d.ts](../src/worker-configuration.d.ts), `cf-typegen` script                                                                                                                                                                                                                          | CF types                                                              | Delete                                                                                              |
| 9   | [test-utils.ts](../src/lib/server/services/test-utils.ts) and spec mocks of `platform.ctx.waitUntil`                                                                                                                                                                                                                                                | Test the above                                                        | Update to new background util                                                                       |

Optional (works on Node, left as-is unless you want it):

- [mailgun.repository.ts](../src/lib/server/repositories/mailgun.repository.ts) hand-rolled `fetch` (replaced `mailgun.js` for workers). Fine to keep.
- [google_calendar.repository.ts](../src/lib/server/repositories/google_calendar.repository.ts) manual JWT via `crypto.subtle`. Works on Node.

## Changes by Area

### 1. Runtime

- `svelte.config.js`: `adapter-node`; drop `routes` config.
- `package.json`: remove `wrangler`, `@sveltejs/adapter-cloudflare`, `@libsql/client`, `s3mini`, `p-retry`; scripts `preview`, `deploy`, `cf-typegen`, `db:migrate*` replaced.
- Delete `wrangler.jsonc`, `src/worker-configuration.d.ts`.
- Env needed by adapter-node:
  - `ORIGIN` (or `PROTOCOL_HEADER`/`HOST_HEADER` behind a proxy). Without it remote functions fail the CSRF origin check.
  - `BODY_SIZE_LIMIT`. Default is 512K. Must be ≥ `printRequest.maxUploadMB` (currently 1000 MB) or uploads fail.
  - `TZ=UTC` (see timestamps below).

### 2. Database

- `schema.ts`: `sqliteTable` → `pgTable`.
  - `integer(..., { mode: 'boolean' })` → `boolean`.
  - `text(..., { mode: 'json' })` → `jsonb` (`settings.value`, `square_webhook_log.payload`).
  - `luxonTimestamp` → pg custom type on `timestamp(3) with time zone`.
  - Keep text IDs, text enums, and `class_instance.date`/`start_time` as text. No data reshaping beyond types.
- `custom/luxon.ts`: convert with `dt.toUTC()` on write. The current `toDriver` writes `toISO({ includeOffset: false })` in the DateTime's own zone, and `fromDriver` returns `America/Chicago`. Re-saving a value read from the DB shifts it by the Chicago offset. Hidden on Workers because `DateTime.now()` is UTC there.
- `db/index.ts`: module-level `postgres()` client + `drizzle()`; no `getRequestEvent()`.
- `base.repository.ts`: `Database` type from `drizzle-orm/postgres-js`.
- Query call sites (~40):
  - `.get()` → destructure first row; `.all()` → drop.
  - `like` → `ilike` in [print_request.repository.ts:47](../src/lib/server/repositories/print_request.repository.ts#L47) and [waiver.repository.ts:32](../src/lib/server/repositories/waiver.repository.ts#L32). SQLite `LIKE` is case-insensitive; Postgres is not.
  - [waiver.repository.ts:71](../src/lib/server/repositories/waiver.repository.ts#L71) `like(id, id)` → `eq`.
- Migrations: the 19 SQLite migrations are deleted (still in git history) and replaced by a Postgres baseline `0000_baseline.sql`. `pnpm db:migrate` / `node scripts/migrate.ts` applies them.
- `print_request_comment_file`'s FK has an explicit name. The generated one is longer than Postgres' 63-character identifier limit.
- `drizzle.config.ts`: `dialect: 'postgresql'`.
- [migrations.spec.ts](../src/lib/server/db/migrations.spec.ts): rewrite to apply migrations to a real Postgres and compare columns with `information_schema`. Reads `TEST_DATABASE_URL`. `test.yml` adds a `postgres` service container.

### 3. Storage

- `utils/s3.ts` replaced by `utils/storage.ts`: `saveFile(file, key)`, `openFile(key)`, `fileUrl(key)`. Root is `STORAGE_DIR`.
- Keys stay identical (`print_requests/<id>/<uuid>`, `inventory/...`, `waivers/...`, class photos, comment attachments). Migration `0013` already made DB values relative, so no DB rewrite.
- Serving: `src/routes/files/[...key]/+server.ts` streams from disk with path-traversal guard.
- Access by prefix:

  | Prefix                                | Used by                       | Access     |
  | ------------------------------------- | ----------------------------- | ---------- |
  | `inventory/`                          | public scan page              | public     |
  | `classes/`                            | public class pages            | public     |
  | `waivers/`                            | staff waiver view             | signed URL |
  | `print_requests/` (incl. `comments/`) | staff queue, OrcaSlicer links | signed URL |

- Signed URLs: `fileUrl(key)` appends `?expires=<unix>&signature=<hmac>` for gated prefixes. HMAC-SHA256 over `key:expires` with `FILE_SIGNING_SECRET`, valid 12 hours. The route checks signature and expiry.
  - Session cookies alone won't work: `orcaslicer://open?file=<url>` in [RequestComments.svelte](../src/routes/staff/print_requests/queue/RequestComments.svelte) fetches outside the browser. The slicer link now resolves the relative URL against the page origin.
- Files are served as `application/octet-stream` with `nosniff` and `CSP: sandbox`, since uploads now share the app's origin.
- Remove `s3` getter from `base.repository.ts`; repositories call the storage util.
- Env: drop `S3_*`; add `STORAGE_DIR`, `FILE_SIGNING_SECRET`.

### 4. Image and CI

Scope ends at a published image; Kubernetes manifests are out of scope.

- `Dockerfile`: multi-stage, `node:24-slim`, runs `node build` as `node` on port 3000. `STORAGE_DIR=/data`, `TZ=UTC` baked in.
- Migrations: same image, `node scripts/migrate.ts`. Run as a k8s init container or Job.
- `.github/workflows/deploy.yml` → `image.yml`: on release-please merge, pushes `ghcr.io/starforgefoundry/orion:<version>` and `:latest`.
- `test.yml`: `postgres:17` service, `TEST_DATABASE_URL` set. The migrations spec skips locally without it.
- Requirements for the cluster side:
  - PVC mounted at `/data`. With `ReadWriteOnce`, run 1 replica.
  - `ORIGIN` (public URL) and `BODY_SIZE_LIMIT` (e.g. `1G`) set, plus every var in `.env.example`.
  - Ingress body size limit raised to match uploads (e.g. nginx `proxy-body-size`).

### 5. Import Tooling

[scripts/import-d1.ts](../scripts/import-d1.ts) (`pnpm db:import-d1 <d1.sql>`):

- Loads the D1 export into in-memory SQLite, then copies tables in FK order into Postgres in one transaction.
- Converts by Postgres column type: `0/1` → boolean, JSON text → `jsonb`, `YYYY-MM-DD HH:MM:SS.ffffff` → UTC timestamp. Unrecognized values abort with `table.column`.
- Refuses to run if any target table has rows. Verifies row counts at the end.

[scripts/verify-files.ts](../scripts/verify-files.ts): checks every file key in Postgres exists under `STORAGE_DIR`.

Timestamp caveat: the old Luxon type stored a row's Chicago wall-clock time as UTC whenever a value read from D1 was saved again. Those rows are off by 5–6 hours in D1 already and import as-is. Spot-check `completionDate`, `payment_date` and `added_date`.

Configuration:

- `settings` table (Square IDs, Discord webhooks, Bambuddy, upload limits) moves with the data.
- Cloudflare secrets cannot be read back. Re-source from the original providers or password manager: Google OAuth, service account key, `AUTH_SECRET`, Square, Mailgun.
- Keep `AUTH_SECRET` the same or all sessions are invalidated.

## Migration Plan

### Phase 1: Code

Branch `feat/node-migration`, merged via PR. Merge only after cutover is ready: once merged, the next release publishes an image and no longer deploys the Worker.

### Phase 2: Cutover (off-hours)

`wrangler` is no longer a project dependency; use `npx wrangler@4`. `d1 export` blocks D1 queries while it runs.

1. Set print requests closed in staff settings on the Worker. Wait a few minutes for in-flight `waitUntil` uploads.
2. Export data and files:
   ```sh
   npx wrangler@4 d1 export orion-prod --remote --output=d1.sql
   rclone sync r2:<bucket> <storage-volume>
   ```
3. Apply schema and import (from the image or a checkout with `DATABASE_URL` set):
   ```sh
   node scripts/migrate.ts
   node scripts/import-d1.ts d1.sql
   STORAGE_DIR=<storage-volume> node scripts/verify-files.ts
   ```
4. Deploy the image with secrets set; `FILE_SIGNING_SECRET` is new (`openssl rand -base64 32`).
5. Switch DNS / proxy to the Node host.
6. Update external callbacks if the host changed:
   - Square webhook URL (`SQUARE_WEBHOOK_NOTIFICATION_URL` is part of signature verification).
   - Google OAuth redirect URIs.
7. Smoke test, then reopen print requests.

### Rollback

- D1 and R2 are untouched by the import. Point DNS back at the Worker.
- Writes made on Node after cutover are lost on rollback. Keep the window short.
- Decommission Worker, D1, R2 after ~2 weeks stable.

## Decisions

- Deploy: OCI image to GHCR; Kubernetes handled separately.
- File serving: SvelteKit route.
- Access: `waivers/` and `print_requests/` gated by signed URLs; `inventory/` and `classes/` public.
- DB tests: Postgres service container in CI.
