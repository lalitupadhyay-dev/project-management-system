# PMA — Project Management App
## Complete Setup Guide

This document covers everything you need to go from zero to a running full stack monorepo. It includes not just the steps, but the **why** behind every decision.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [What is a Monorepo?](#what-is-a-monorepo)
3. [Turborepo — Why We Use It](#turborepo)
4. [Scaffold the Monorepo](#scaffold-the-monorepo)
5. [Rename the Namespace](#rename-the-namespace)
6. [Understanding the Structure](#understanding-the-structure)
7. [How npm Workspaces Work](#how-npm-workspaces-work)
8. [How One Command Runs Everything](#how-one-command-runs-everything)
9. [Setting Up apps/api — Express + TypeScript](#setting-up-appsapi)
10. [Docker — PostgreSQL + Redis](#docker--postgresql--redis)
11. [Prisma 7 Setup](#prisma-7-setup)
12. [Key Concepts Explained](#key-concepts-explained)
13. [Common Commands Reference](#common-commands-reference)

---

## Prerequisites

Make sure you have these installed before starting:

```bash
node --version    # v20 or higher (Prisma 7 requires v20.19+)
npm --version     # v8 or higher
git --version     # any recent version
docker --version  # Docker Desktop running
```

**VS Code Extensions to install:**
- Prisma
- ESLint
- Tailwind CSS IntelliSense
- TypeScript (built-in)

---

## What is a Monorepo?

A monorepo is a **single Git repository** that holds multiple apps and packages together.

**Without monorepo (multiple repos):**
```
github.com/you/pma-frontend   ← separate repo
github.com/you/pma-backend    ← separate repo
```

**Problems this causes:**
- Duplicated TypeScript types between frontend and backend — they drift out of sync, causing bugs
- Multiple terminals, multiple `npm install`s, constant context switching
- No shared tooling — ESLint rules and TS config drift between projects

**With monorepo:**
```
github.com/you/pma   ← everything in one place
  apps/web           ← React frontend
  apps/api           ← Express backend
  packages/types     ← shared TypeScript types (used by both)
  packages/ui        ← shared React components
```

One `git clone`, one `npm install`, one `npm run dev` — everything works.

---

## Turborepo

A plain monorepo without tooling becomes slow and messy at scale. **Turborepo** solves this by:

- Running tasks (dev, build, lint) across all apps **in parallel**
- **Caching** build outputs — if nothing changed, it skips the rebuild
- Managing the **correct execution order** — builds dependencies before apps that depend on them

This is how companies like Vercel, Linear, and Notion structure their codebases.

---

## Scaffold the Monorepo

Use the `with-vite` example template — this gives you React + Vite already configured, no Next.js:

```bash
npx create-turbo@latest -e with-vite
```

When prompted for a project name, enter your project name (e.g. `pma`).

```bash
cd pma
code .        # open in VS Code
npm install   # install all dependencies
```

**Why `with-vite` and not the default template?**
The default Turborepo template uses Next.js. For learning full stack deeply, React + Vite is better — you control every piece and understand how it works. Next.js abstracts too much away.

---

## Rename the Namespace

The `with-vite` template uses `@with-vite/` as the package namespace. You need to replace this with your own project name.

The namespace is the prefix used for all internal packages:
```typescript
import { Button } from "@pma/ui"       // @pma/ is the namespace
import { Task } from "@pma/types"
```

**In VS Code, open global find and replace (`Ctrl+Shift+H` / `Cmd+Shift+H`):**

```
Find:     @with-vite/
Replace:  @pma/
```

Then:
```
Find:     "name": "with-vite"
Replace:  "name": "pma"
```

After replacing, check these files are updated:

| File | Should Read |
|------|-------------|
| `package.json` | `"name": "pma"` |
| `apps/web/package.json` | `"name": "@pma/web"` |
| `packages/ui/package.json` | `"name": "@pma/ui"` |
| `packages/typescript-config/package.json` | `"name": "@pma/typescript-config"` |
| `packages/eslint-config/package.json` | `"name": "@pma/eslint-config"` |

Then reinstall to re-resolve the renamed packages:

```bash
npm install
```

> **Rule:** The namespace (`@pma/`) is not special syntax — it's just an npm scoping convention. Name it after your project. It makes it immediately clear these are your internal packages, not third-party npm packages.

---

## Understanding the Structure

```
pma/
│
├── apps/                        # Runnable applications
│   ├── web/                     # React + Vite frontend
│   └── api/                     # Express + TypeScript backend
│
├── packages/                    # Shared code (imported by apps, not run directly)
│   ├── ui/                      # Shared React components
│   ├── typescript-config/       # Shared TypeScript configuration
│   └── eslint-config/           # Shared ESLint rules
│
├── turbo.json                   # Turborepo task configuration
├── package.json                 # Root workspace definition
├── docker-compose.yml           # PostgreSQL + Redis
└── .gitignore
```

**The key mental model:**
- `apps/` = things you **run**
- `packages/` = things you **import**

### What Each Package Does

**`packages/typescript-config`**
Shared TypeScript config that all apps extend. Change a rule once — it applies everywhere.
```json
// apps/web/tsconfig.json
{ "extends": "@pma/typescript-config/vite.json" }

// apps/api/tsconfig.json
{ "extends": "@pma/typescript-config/base.json" }
```

**`packages/eslint-config`**
Shared ESLint rules for code quality. One place to enforce standards across the whole codebase.
```javascript
// apps/web/.eslintrc.js
module.exports = { extends: ["@pma/eslint-config/react"] }
```

**`packages/ui`**
Shared React component library — buttons, inputs, modals. Change a component once, it updates everywhere.
```typescript
import { Button } from "@pma/ui"   // used in web, admin, anywhere
```

---

## How npm Workspaces Work

The root `package.json` defines workspaces:

```json
{
  "name": "pma",
  "private": true,
  "workspaces": ["apps/*", "packages/*"]
}
```

This tells npm three things:

**1. Treat every folder in `apps/` and `packages/` as its own package.**

**2. Hoist all `node_modules` to the root** — instead of each app having its own copy:
```
# Without workspaces (wasteful)
apps/web/node_modules/react      ← copy 1
apps/api/node_modules/typescript ← copy 2

# With workspaces (efficient)
node_modules/react               ← one shared copy
node_modules/typescript          ← one shared copy
```

**3. Create symlinks for local packages:**
```
node_modules/@pma/ui  →  symlink  →  packages/ui/src/index.ts
```
When your code imports `@pma/ui`, it resolves to your local `packages/ui` folder instantly — no publishing to npm needed. Change `packages/ui` and the change is immediately reflected in `apps/web`.

> **Important:** Always install packages from the **root** using the workspace flag. Never `cd` into an app and run `npm install` — it creates a local `node_modules` defeating the purpose.
> ```bash
> # Correct
> npm install express --workspace=apps/api
> npm install react --workspace=apps/web
> npm install -D tsx --workspace=apps/api
> ```

---

## How One Command Runs Everything

When you run `npm run dev` at the root:

```
npm run dev
    │
    ▼
root package.json → "dev": "turbo run dev"
    │
    ▼
turbo.json → reads task config
    │
    ▼
Scans all workspaces (apps/* and packages/*)
    │
    ├── apps/web    → has "dev" script? ✅ → run "vite"
    ├── apps/api    → has "dev" script? ✅ → run "tsx watch src/index.ts"
    ├── packages/ui → has "dev" script? ❌ → skip
    └── packages/*  → has "dev" script? ❌ → skip
    │
    ▼
Both apps start in parallel, color-coded output
    │
    ├── @pma/web → http://localhost:5173
    └── @pma/api → http://localhost:4000
```

### Understanding `turbo.json`

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],   // ^ means: build dependencies first
      "outputs": ["dist/**"]     // cache these outputs
    },
    "dev": {
      "persistent": true,        // runs forever (dev server)
      "cache": false             // never cache dev servers
    }
  }
}
```

**`"dependsOn": ["^build"]`** — if `apps/web` depends on `packages/ui`, Turborepo builds `packages/ui` first automatically. Order is managed for you.

**`"outputs": ["dist/**"]`** — Turborepo caches build outputs. If nothing changed in `packages/ui`, it won't rebuild it — uses cached result. Dramatically faster CI builds.

---

## Setting Up apps/api

Create the folder and files:

```bash
mkdir -p apps/api/src
```

**`apps/api/package.json`:**
```json
{
  "name": "@pma/api",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint ."
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/node": "^20.0.0",
    "tsx": "^4.7.0",
    "typescript": "^5.0.0"
  }
}
```

> **Why `tsx`?** Runs TypeScript files directly without compiling first — perfect for development. The `watch` flag auto-restarts on every file change.

> **Why `cors`?** Frontend on port 5173 and backend on port 4000 are different origins. Without CORS headers, the browser blocks requests between them.

**`apps/api/tsconfig.json`:**
```json
{
  "extends": "@pma/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "generated"]
}
```

**`apps/api/src/index.ts`:**
```typescript
import express from "express"
import cors from "cors"
import dotenv from "dotenv"

dotenv.config()

const app = express()
const PORT = process.env.PORT || 4000

app.use(cors({ origin: "http://localhost:5173", credentials: true }))
app.use(express.json())

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "PMA API is running" })
})

app.listen(PORT, () => {
  console.log(`🚀 API running at http://localhost:${PORT}`)
})
```

**`apps/api/.env`:**
```
PORT=4000
NODE_ENV=development
DATABASE_URL="postgresql://pma_user:pma_password@localhost:5432/pma_db"
REDIS_URL=redis://localhost:6379
```

**`apps/api/.env.example`** (commit this, not `.env`):
```
PORT=4000
NODE_ENV=development
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/DB_NAME"
REDIS_URL=redis://localhost:6379
```

Add to root `.gitignore`:
```
.env
*.env
apps/api/generated/
```

Install from root:
```bash
npm install
```

---

## Docker — PostgreSQL + Redis

Docker runs PostgreSQL and Redis in isolated containers — consistent across every machine, easy to reset.

**`docker-compose.yml`** (at the root):
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: pma_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: pma_user
      POSTGRES_PASSWORD: pma_password
      POSTGRES_DB: pma_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: pma_redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

> **Why volumes?** Containers are ephemeral — deleting a container deletes all data. Volumes persist data outside the container on your machine. Your database survives restarts and container recreations.

> **Why `alpine`?** Lightweight Linux image — smaller, faster than the full image.

> **Why `restart: unless-stopped`?** Auto-restart on crash. Don't restart only if you manually stopped it.

**Start containers:**
```bash
docker compose up -d      # -d = detached, runs in background
```

**Verify both are running:**
```bash
docker compose ps
```

**Test PostgreSQL:**
```bash
docker exec -it pma_postgres psql -U pma_user -d pma_db
# Type \q to exit
```

**Test Redis:**
```bash
docker exec -it pma_redis redis-cli ping
# Should respond: PONG
```

### Useful Docker Commands

```bash
docker compose up -d          # start containers
docker compose stop           # stop (data preserved)
docker compose down           # stop + remove containers (data preserved in volumes)
docker compose down -v        # stop + remove everything including data
docker compose logs postgres  # view logs
docker compose restart postgres
```

---

## Prisma 7 Setup

Prisma is a type-safe ORM. Instead of raw SQL you write TypeScript — and the result is fully typed.

> **Prisma 7 key changes:**
> - Rewrote client in TypeScript (dropped Rust engine) → 90% smaller bundle, 3x faster queries
> - Generated client moves out of `node_modules` into your project source
> - New `prisma.config.ts` file for all configuration
> - Uses explicit driver adapter (`@prisma/adapter-pg`) for PostgreSQL

### Install

From root:
```bash
npm install prisma @types/pg --save-dev --workspace=apps/api
npm install @prisma/client @prisma/adapter-pg pg dotenv --workspace=apps/api
```

### Initialize

```bash
cd apps/api
npx prisma init --datasource-provider postgresql --output ../generated/prisma
cd ../..
```

This creates:
```
apps/api/
├── prisma/
│   └── schema.prisma
├── prisma.config.ts    ← new in Prisma 7
└── .env                ← DATABASE_URL added
```

### `prisma.config.ts`

```typescript
import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})
```

### `prisma/schema.prisma` (base structure)

```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
}

// Define your models here
```

> **`provider = "prisma-client"`** — the new Rust-free generator. Not `"prisma-client-js"` anymore.
> **`output = "../generated/prisma"`** — generates client into your project source, not `node_modules`.

### `src/lib/prisma.ts`

```typescript
import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../generated/prisma/client'

const connectionString = process.env.DATABASE_URL!
const adapter = new PrismaPg({ connectionString })

export const prisma = new PrismaClient({ adapter })
```

### Run Migration

After writing your schema, make sure Docker is running then:

```bash
cd apps/api
npx prisma migrate dev --name init
```

This:
1. Reads `schema.prisma`
2. Generates SQL to create your tables
3. Saves SQL to `prisma/migrations/`
4. Runs SQL against PostgreSQL
5. Generates the typed client into `generated/prisma/`

> The `generated/` folder does not exist until you run this command. Never import from it before migrating.

### Prisma Studio (Visual DB Browser)

```bash
cd apps/api
npx prisma studio    # opens at http://localhost:5555
```

### Future Schema Changes

Every time you change `schema.prisma`:
```bash
npx prisma migrate dev --name describe-your-change
# example: --name add-due-date-to-tasks
```

---

## Key Concepts Explained

### ESM vs CJS

JavaScript has two module systems:

| | CJS (old) | ESM (modern) |
|---|---|---|
| Syntax | `require()` / `module.exports` | `import` / `export` |
| Loading | Synchronous | Asynchronous |
| Browser native | No | Yes |
| Tree shaking | Hard | Easy |

Prisma 7 is ESM-first, so your backend needs ESM compatibility.

### `"module": "ESNext"` in tsconfig

Tells TypeScript — *"output modern JavaScript as-is, don't downgrade syntax."* Since your API runs on Node.js 20+, no downgrading is needed.

### `"moduleResolution": "bundler"` in tsconfig

Tells TypeScript which rulebook to use when locating imported files. `"bundler"` mode understands modern `package.json` `exports` fields and subpath imports — required for Prisma 7 and modern packages.

> This does NOT mean a bundler is running your code. It's just the name of the resolution algorithm.

### `"esModuleInterop": true` in tsconfig

Many packages like Express are CJS internally and don't have a proper `default` export. Without this flag you'd need:
```typescript
import * as express from 'express'   // ugly
```
With this flag TypeScript adds a compatibility helper so you can write:
```typescript
import express from 'express'        // clean
```

### `include` and `exclude` in tsconfig

```json
"include": ["src"]                              // only compile files in src/
"exclude": ["node_modules", "dist", "generated"] // never touch these
```

`include` is a whitelist, `exclude` is a safety net. Together they ensure TypeScript only compiles your actual source code — not generated files, compiled output, or third-party packages.

---

## Common Commands Reference

```bash
# Start everything
npm run dev

# Install a package for a specific app
npm install <package> --workspace=apps/api
npm install <package> --workspace=apps/web
npm install -D <package> --workspace=apps/api   # dev dependency

# Docker
docker compose up -d        # start DB + Redis
docker compose stop         # stop
docker compose down -v      # reset everything including data

# Prisma
npx prisma migrate dev --name <migration-name>   # apply schema changes
npx prisma generate                              # regenerate client only
npx prisma studio                               # visual DB browser
npx prisma migrate reset                        # reset DB (dev only)

# Git
git add .
git commit -m "feat: your message here"
```

---

## Final Running Checklist

Before running `npm run dev`, make sure:

- [ ] Docker Desktop is open and running
- [ ] `docker compose up -d` has been run
- [ ] `apps/api/.env` has correct `DATABASE_URL`
- [ ] `npm install` has been run from the root
- [ ] Prisma migration has been run at least once (`npx prisma migrate dev --name init`)

Then:
```bash
npm run dev
```

| App | URL |
|-----|-----|
| Frontend (React + Vite) | http://localhost:5173 |
| Backend (Express) | http://localhost:4000 |
| Health check | http://localhost:4000/api/health |
| Prisma Studio | http://localhost:5555 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |
