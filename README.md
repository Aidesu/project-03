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

- Node.js v24.15+ (or v22.22.3+) see `.nvmrc` (`nvm use`)
- pnpm 10+ (`corepack enable` or `npm i -g pnpm`)
- Docker + Docker Compose v2 (for the local infrastructure — see below)

## Infrastructure (Docker)

The local data layer runs in Docker Compose (defined in `docker-compose.yml` at the repo root):

| Service | Image            | Purpose                                                        | Ports          |
| ------- | ---------------- | -------------------------------------------------------------- | -------------- |
| `db`    | `postgres:16`    | Primary database (used by Prisma)                              | `5432`         |
| `redis` | `redis:7`        | Cache / sessions / job queue (reminders & follow-ups)          | `6379`         |
| `minio` | `minio/minio`    | S3-compatible object storage (CVs, cover letters, offer PDFs)  | `9000`, `9001` |

```bash
cp .env.example .env          # root .env — adjust secrets (gitignored)
docker compose up -d          # start db + redis + minio
docker compose ps             # all services should be "healthy"
```

- MinIO console: http://localhost:9001 (login = `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`).
- Data persists in named volumes (`pgdata`, `redisdata`, `miniodata`). To wipe everything: `docker compose down -v`.

> **Security** — the defaults in `.env.example` are **dev-only**. Before any non-local
> deployment, set strong unique secrets and run the volumes on an encrypted disk
> (encryption at rest). Application-level data isolation (each user only sees their own
> data) is enforced in the API layer.

## Getting started

### 1. Backend

```bash
cd backend
pnpm install
cp .env.example .env          # then adjust DATABASE_URL / REDIS_URL / S3_*
pnpm prisma:migrate           # creates tables from the Prisma schema
pnpm start:dev                # http://localhost:3000
```

### 2. Frontend

```bash
cd frontend
pnpm install
pnpm start                    # http://localhost:4200
```

## Environment variables (backend)

| Variable       | Description                          | Default                 |
| -------------- | ------------------------------------ | ----------------------- |
| `DATABASE_URL` | PostgreSQL connection string         | see `.env.example`      |
| `PORT`         | HTTP server port                     | `3000`                  |
| `CORS_ORIGIN`  | Allowed origin(s), comma-separated   | `http://localhost:4200` |
| `REDIS_URL`    | Redis connection string              | see `.env.example`      |
| `S3_ENDPOINT`  | MinIO/S3 endpoint for attachments    | `http://localhost:9000` |
| `S3_BUCKET`    | Bucket for uploaded files            | `project03-uploads`     |

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

## Domain model

Job-search tracker, fully **per-user isolated**. Core Prisma models (see
`backend/prisma/schema.prisma`):

| Group         | Models |
| ------------- | ------ |
| Identity      | `User`, `UserSettings`, `RefreshSession` |
| Applications  | `JobApplication` (status, salary, work mode, dates, priority…), `Company`, `Contact` |
| Pipeline      | `Interview`, `ApplicationStatusEvent` (status history → funnel & timing stats) |
| Attachments   | `Document` (metadata; bytes in MinIO/S3), `Tag` + `ApplicationTag` |
| Follow-ups    | `Reminder` (due dates → Redis job queue) |
| Gamification  | `GamificationProfile` (XP, level, streaks), `XpEvent` (append-only ledger), `Achievement` + `UserAchievement` |

Deleting a company nulls the link on its applications (kept); deleting an application keeps the
XP history. Statistics are derived from `ApplicationStatusEvent` + timestamps (no snapshot tables
in v1).

## License

This project is licensed under the [MIT License](./LICENSE).
