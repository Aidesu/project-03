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
- A running PostgreSQL instance (Docker setup to come later)

## Getting started

### 1. Backend

```bash
cd backend
pnpm install
cp .env.example .env          # then adjust DATABASE_URL
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

| Variable       | Description                        | Default                 |
| -------------- | ---------------------------------- | ----------------------- |
| `DATABASE_URL` | PostgreSQL connection string       | see `.env.example`      |
| `PORT`         | HTTP server port                   | `3000`                  |
| `CORS_ORIGIN`  | Allowed origin(s), comma-separated | `http://localhost:4200` |

## License

This project is licensed under the [MIT License](./LICENSE).
