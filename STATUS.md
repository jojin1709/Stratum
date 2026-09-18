# Build status

Honest accounting of what is implemented, tested, and verified — versus written
but unverified, versus not started. Read this before continuing the build.

## Tested and verified

| Package | Tests | What's covered |
|---|---|---|
| `@stratum/shared` | 12 | Error taxonomy, identifier/type injection resistance, API key hashing/masking |
| `@stratum/database` | 23 | Query builder SQL generation, DDL rendering, migration file parsing, adapter config validation |
| `@stratum/storage` | 9 | Local driver round-trip, path traversal rejection, bucket naming |
| `@stratum/realtime` | 10 | Protocol parsing, hub subscribe/broadcast/presence, channel cleanup |
| `@stratum/functions` | 9 | Worker-compat static analysis, discovery, in-process invocation |
| `@stratum/client` | 13 | Query builder → URL translation, error surfacing, storage upload paths |
| `@stratum/cli` | 8 | Project root resolution, `.env` parsing, output formatting |
| `apps/api` (integration) | 35 | **Runs against real Postgres.** Auth boundaries (public vs secret key), full DDL lifecycle, automatic REST CRUD with filters/sort/pagination, SQL injection attempts, unfiltered-write refusal, SQL editor read-only mode, key create/revoke/rotate, storage upload/download/traversal, function discovery/invoke/logs, realtime trigger + status, migration apply/rollback/tamper-detection, generated OpenAPI, measured overview metrics |

Run them yourself:
```bash
pnpm test
TEST_DATABASE_URL=postgres://user:pass@host/db pnpm --filter @stratum/api test
```

## Written and manually exercised, not covered by automated tests

- **CLI commands end-to-end**: `init`, `db migration create`, `db migrate`,
  `db status`, `types generate` were run against a live Postgres instance
  during development and worked correctly (including catching the
  `search_path` bug below). `dev`, `start`, `stop`, `status`, `logs`,
  `functions deploy` were written but not exercised — they depend on Docker.
- **Dashboard**: builds clean (`next build`, zero TypeScript errors), all 7
  pages implemented per the spec (Overview, Database with tables/SQL
  editor/migrations, API with explorer and key management, Storage,
  Realtime, Functions, Settings).
- **Docker**: `docker-compose.yml` and both `Dockerfile`s were written
  against the actual package structure (correct workspace filter names,
  correct build order).

## Not started

- `docs/` site (only `docs/security.md` exists)
- `examples/` (nextjs-app, vanilla-js, realtime-chat — directories exist, empty)
- `CONTRIBUTING.md`
- Playwright E2E suite (`test:e2e` script exists in root `package.json`)
- CLI `storage` command (listed in the CLI help structure, not implemented)
- Presence/broadcast demo in the SDK beyond the unit-tested primitives

## Four real bugs found by testing against live Postgres

These cost real debugging time and are exactly the kind of thing that looks
fine until you run it. Full detail in `README.md`; one-line summary:

1. `search_path` defaults to `"$user", public` — a DB user named `stratum`
   collided with the reserved `stratum` schema, silently swallowing
   unqualified DDL. Fixed by pinning the search path on the connection.
2. `pg` returns an array of results for multi-statement scripts; the adapter
   now normalises to the last result.
3. Minute-granularity migration version timestamps collide; now second-granular.
4. `/realtime/v1/tables` was outside the auth middleware's path prefix and
   rejected every caller, including valid secret keys.

If you extend the database or migration layer, re-run the integration suite
before trusting new behavior — none of these four were caught by unit tests
or by reading the code. They only showed up against a real database.

## Recommended next steps, in order

1. `docker compose build`
2. `docker compose up -d` — bring up the full stack, open `localhost:8787`,
   click through every dashboard page against real data.
3. `examples/nextjs-app` — a real Next.js app using `@stratum/client`
   end to end is the best remaining integration test.
4. Docs site and Playwright E2E last.
