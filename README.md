# project-03

## Stack

| Layer    | Technology                        |
| -------- | --------------------------------- |
| Frontend | Angular 22 (standalone, zoneless) |
| Backend  | NestJS 11 (Node, TypeScript)      |
| ORM      | Prisma 6                          |
| Database | PostgreSQL                        |
| Tooling  | pnpm                              |

## Project structure

```
project-03/
├── backend/      # NestJS API (Prisma + PostgreSQL)
│   ├── prisma/   # Prisma schema & migrations
│   └── src/
├── frontend/     # Angular application
└── README.md
```

## Prerequisites

- Docker + Docker Compose v2 — the only requirement to run the full stack.
- Node.js v24.15+ (or v22.22.3+) / pnpm 10+ are only needed if you run a service
  **outside** Docker (see [Running without Docker](#running-without-docker)).

## Running the full stack (Docker)

Everything — Postgres, Redis, MinIO, the NestJS API, and the Angular dev server — runs
in Docker Compose (`docker-compose.yml` at the repo root). Both app containers build
from a dev `Dockerfile.dev`, bind-mount `src/` from the host, and hot-reload on save.

| Service    | Image / build          | Purpose                                                       | URL / Port                       |
| ---------- | ----------------------- | -------------------------------------------------------------- | --------------------------------- |
| `db`       | `postgres:16-alpine`    | Primary database (used by Prisma)                               | `5432`                            |
| `redis`    | `redis:7-alpine`        | Rate-limit counters, shared across API instances                 | `6379`                             |
| `minio`    | `minio/minio`           | S3-compatible object storage (CVs, cover letters, offer PDFs)    | `9000` (API), `9001` (console)    |
| `backend`  | `backend/Dockerfile.dev`| NestJS API (`nest start --watch` under the hood)                 | http://localhost:3000/api         |
| `frontend` | `frontend/Dockerfile.dev`| Angular app (`ng serve`)                                        | http://localhost:4200             |

```bash
cp .env.example .env                    # root .env — Docker Compose secrets (gitignored)
cp backend/.env.example backend/.env    # backend app secrets (JWT, CSRF…) — gitignored

docker compose up -d --build            # build images and start the whole stack
docker compose ps                       # all services should become "healthy"

# First run only (and after any new Prisma migration):
docker compose exec backend pnpm prisma:migrate
```

- App: http://localhost:4200 — Angular proxies `/api` to the `backend` container.
- API directly: http://localhost:3000/api
- MinIO console: http://localhost:9001 (login = `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`).
- Data persists in named volumes (`pgdata`, `redisdata`, `miniodata`,
  `backend_node_modules`, `frontend_node_modules`, `frontend_angular_cache`).
  To wipe everything (including the database): `docker compose down -v`.

Useful day-to-day commands:

```bash
docker compose logs -f backend frontend   # follow hot-reload / app logs
docker compose exec backend sh            # shell into the API container
docker compose exec backend pnpm prisma:studio   # Prisma Studio (bind it to a port if needed)
docker compose up -d --build              # rebuild after editing package.json, a lockfile,
                                           # or either Dockerfile.dev
```

Editing `backend/src` or `frontend/src` on the host reloads the corresponding container
automatically — no rebuild needed for source-only changes.

> **Security** — the defaults in `.env.example` / `backend/.env.example` are **dev-only**.
> Before any non-local deployment: set strong unique secrets, run the data volumes on an
> encrypted disk (encryption at rest), and never reuse `Dockerfile.dev` (hot-reload, no
> multi-stage build) in production. Application-level data isolation (each user only sees
> their own data) is enforced in the API layer.

## Running without Docker

Only needed if you want to run a service directly on the host (e.g. for debugging). You
still need `db` / `redis` / `minio` running somewhere — either via `docker compose up -d
db redis minio`, or your own local instances.

### 1. Backend

```bash
cd backend
pnpm install
cp .env.example .env          # then adjust DATABASE_URL / REDIS_URL / S3_* to point at localhost
pnpm prisma:migrate           # creates tables from the Prisma schema
pnpm start:dev                # http://localhost:3000
```

### 2. Frontend

```bash
cd frontend
pnpm install
pnpm start                    # http://localhost:4200 — proxies /api to localhost:3000
```

## Environment variables (backend)

| Variable       | Description                          | Default                 |
| -------------- | ------------------------------------ | ----------------------- |
| `DATABASE_URL` | PostgreSQL connection string         | see `.env.example`      |
| `PORT`         | HTTP server port                     | `3000`                  |
| `CORS_ORIGIN`  | Allowed origin(s), comma-separated   | `http://localhost:4200` |
| `REDIS_URL`    | Rate-limit counter store; required in production | see `.env.example`      |
| `S3_ENDPOINT`  | MinIO/S3 endpoint for attachments    | `http://localhost:9000` |
| `S3_BUCKET`    | Bucket for uploaded files            | `project03-uploads`     |
| `AUDIT_LOG_RETENTION_DAYS` | How long audit entries are kept (they hold IPs) | `365` |

## Authentication

Cookie-based JWT, **secure by default**. Tokens live in httpOnly, SameSite=strict cookies
(`Secure` in production). Endpoints under `/api/auth`: `GET /csrf`, `POST /register`,
`POST /login`, `POST /refresh`, `POST /logout`, `GET /me`.

- Clients call `GET /api/auth/csrf` once, then echo the `XSRF-TOKEN` cookie back as the
  `X-XSRF-TOKEN` header on mutating requests (Angular's `HttpClient` does this automatically).
- Passwords are hashed with **argon2id**; refresh tokens are opaque, stored hashed, and
  **rotate with reuse detection** (replaying a revoked token revokes the whole session family).
- Every route requires a valid access token unless marked `@Public()`. Login/register are
  rate-limited; `helmet` sets security headers.

### Data export (GDPR)

`GET /api/users/me/export` returns everything the product holds for the calling account as one
JSON document — profile, settings, applications and their status history, interviews, companies,
contacts, documents, reminders, tags, templates, gamification, sessions and audit entries — read
in a single transaction so the file is a consistent snapshot. It is rate limited to 3 calls per
hour and recorded as `DATA_EXPORTED` in the audit trail.

Domain tables are exported whole, so a column added later shows up by default. The two tables
holding credentials (`User`, `RefreshSession`) are read through an explicit allowlist instead, and
verification tokens are never exported: a live recovery link in a downloaded file is an account
takeover waiting to happen.

### Audit trail

Security-relevant events (login success/failure, logout, password change, password reset,
address change and verification, account deletion, refresh-token replay) are appended to
`AuditLog` with the actor, the IP, the user agent and the request's correlation id.

The table is **append-only**: a Postgres trigger rejects `UPDATE` outright. `DELETE` stays
available because it is how retention is applied — a nightly job drops entries older than
`AUDIT_LOG_RETENTION_DAYS`. No e-mail address is ever copied into an entry; a known account is
identified by its internal id, an attempt on an unknown address by nothing at all.

## Domain model

Job-search tracker, fully **per-user isolated**. Core Prisma models (see
`backend/prisma/schema.prisma`):

| Group         | Models |
| ------------- | ------ |
| Identity      | `User`, `UserSettings`, `RefreshSession`, `VerificationToken`, `AuditLog` (append-only) |
| Applications  | `JobApplication` (status, salary, work mode, dates, priority…), `Company`, `Contact` |
| Pipeline      | `Interview`, `ApplicationStatusEvent` (status history → funnel & timing stats) |
| Attachments   | `Document` (metadata; bytes in MinIO/S3), `Tag` + `ApplicationTag` |
| Follow-ups    | `Reminder` (due dates; in-app only — e-mail reminders are not wired yet) |
| Gamification  | `GamificationProfile` (XP, level, streaks), `XpEvent` (append-only ledger), `Achievement` + `UserAchievement` |

Deleting a company nulls the link on its applications (kept); deleting an application keeps the
XP history. Statistics are derived from `ApplicationStatusEvent` + timestamps (no snapshot tables
in v1).

## License

This project is licensed under the [MIT License](./LICENSE).
