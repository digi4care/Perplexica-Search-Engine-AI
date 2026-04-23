# Release Strategy

## Environments

| Environment | Purpose | Who Can Access | Data |
|---|---|---|---|
| Local | Development and unit/integration testing | Developer only | Local Docker containers, seeded fixtures |
| Staging | Pre-release validation, integration verification | Developer + internal testers | Production-like config, anonymized sample data |
| Production | Live self-hosted instance | End users via configured domain | Real data, persistent volumes |

## Branching & Merge Strategy

Trunk-based development with short-lived feature branches.

- **Main branch:** `master` is always deployable. Merges to `master` require passing CI and at least one review.
- **Feature branches:** Created from `master`, named `refactor/EPIC-SHORT-DESCRIPTION` (e.g., `refactor/SEARCH-ORCHESTRATION`, `refactor/API-THINNING`).
- **Merge method:** Squash-merge to keep `master` history linear and tied to phases.
- **No long-lived release branches.** Each phase is a set of PRs that land on `master` sequentially.

## CI/CD Pipeline

### On Pull Request

1. **Lint** — Biome/eslint check, no warnings allowed
2. **Type check** — `tsc --noEmit` across the monorepo
3. **Unit tests** — Vitest, coverage gate per phase
4. **Integration tests** — Supertest against real route handlers with mocked providers
5. **Build check** — `next build` succeeds, no type errors in output

All steps must pass before merge is enabled.

### On Merge to Main

1. Run full CI suite (same as PR)
2. Build and tag Docker image: `perplexica:sha-<short>` and `perplexica:phase-<N>-latest`
3. Push image to local registry or Docker Hub (if configured)
4. No automatic deploy — images are staged for manual promotion

### Manual: Deploy to Production

```bash
docker compose pull perplexica
docker compose up -d perplexica
```

Verify via health check endpoint (`GET /api/health` → `200 OK`).

## Release Cadence

On-demand after each planning phase completes.

- **Phase boundaries** are natural release points. A phase is releasable when all its PRs are merged, CI is green, and staging validation passes.
- **Hotfixes** bypass phase cadence — branch from `master`, fast-track review, deploy immediately.
- No fixed calendar schedule. Releases follow completion, not dates.

## Rollback Plan

1. **Identify the last-known-good image tag** (e.g., `perplexica:phase-2-latest` or a specific `sha-<short>` tag).
2. **Git revert** the offending merge commit on `master` if the issue is code-level.
3. **Redeploy the previous image:**

   ```bash
   docker compose down perplexica
   docker tag perplexica:sha-<previous> perplexica:current
   docker compose up -d perplexica
   ```

4. **Verify** health check endpoint and run a smoke search query.
5. Rollback target: under 5 minutes from decision to live.

## Versioning

Semantic Versioning (SemVer): `MAJOR.MINOR.PATCH`

- **PATCH** (`0.x.Z`): Internal refactors that preserve behavior — type narrowing, test additions, file moves. No API or config changes.
- **MINOR** (`0.Y.0`): Architecture changes that alter module boundaries, add new interfaces, or change config schema. Backward-compatible.
- **MAJOR** (`X.0.0`): Breaking changes to the API surface, config format, or Docker compose contract. Reserved for post-MVP if the project goes public.

Current version starts at `0.1.0`. Each phase increments the minor version on completion.

## Monitoring & Alerts

| What | Tool | Alert Threshold |
|---|---|---|
| Container health | Docker built-in healthcheck | Restart count > 3 in 10 min |
| Application errors | `docker compose logs perplexica` + structured JSON logs | Error rate > 5% of requests in 5-min window |
| Health check endpoint | `GET /api/health` → `{ status: "ok" }` | Non-200 response or > 5s latency |
| Disk usage | Docker volume monitoring | Volume > 80% capacity |
| Memory usage | Docker stats | Container OOM or > 90% limit sustained 2 min |
