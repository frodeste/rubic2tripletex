# Rubic2Tripletex Integration

One-way data synchronization from Rubic (membership management system) to Tripletex (ERP system), hosted on Vercel with a Next.js App Router architecture.

## What it syncs

| Sync Type  | Direction       | Schedule    | Description                                       |
| ---------- | --------------- | ----------- | ------------------------------------------------- |
| Customers  | Rubic -> TTX    | Every 6h    | Create/update customers using hash-based detection |
| Products   | Rubic -> TTX    | Every 6h    | Create/update products using hash-based detection  |
| Invoices   | Rubic -> TTX    | Every 2h    | Create invoices via order->invoice flow            |
| Payments   | Rubic -> TTX    | Every 1h    | Register payment status from transactions          |

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Runtime**: TypeScript, Node.js 24
- **Package Manager**: Bun
- **Hosting**: Vercel (custom domain: `https://integration.uniteperformance.no`)
- **Database**: Neon Postgres (via Vercel integration)
- **ORM**: Drizzle ORM
- **Linting/Formatting**: Biome.js
- **Auth**: Auth0 (dashboard protection)
- **Dev Environment**: DevContainer (Node 24 + Bun + PostgreSQL 16)

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) installed
- Access to Rubic API credentials
- Access to Tripletex API credentials
- Auth0 tenant configured

### Local Development

1. Clone the repo and install dependencies:

```bash
git clone https://github.com/frodeste/rubic2tripletex.git
cd rubic2tripletex
bun install
```

2. Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

3. Run database migrations:

```bash
bun run db:migrate
```

4. Start the development server:

```bash
bun run dev
```

### Using DevContainer

Open the project in VS Code with the Dev Containers extension. The container provides Node 24, Bun, and a local PostgreSQL instance pre-configured.

## Available Scripts

| Command             | Description                                    |
| ------------------- | ---------------------------------------------- |
| `bun run dev`       | Start Next.js dev server                       |
| `bun run build`     | Production build                               |
| `bun run check`     | Lint + format all files (Biome)                |
| `bun run lint`      | Lint only (no auto-fix)                        |
| `bun run format`    | Format only                                    |
| `bun test`          | Run all tests                                  |
| `bun run db:generate` | Generate Drizzle migration files             |
| `bun run db:migrate`  | Apply migrations to database                 |
| `bun run db:studio`   | Open Drizzle Studio (DB browser)             |

## Project Structure

```
app/                                  # Next.js App Router
  api/
    auth/[...auth0]/route.ts          # Auth0 login/logout/callback
    cron/sync-{type}/route.ts         # Vercel cron endpoints (4 sync types)
    trigger/[syncType]/route.ts       # Manual trigger endpoint (auth-protected)
    health/route.ts                   # Health check endpoint
  components/TriggerButton.tsx        # Client component for manual triggers
  layout.tsx                          # Root layout (Auth0 provider)
  page.tsx                            # Dashboard (sync status + triggers)
src/
  clients/
    rubic.ts                          # Rubic API client (paginated)
    tripletex.ts                      # Tripletex API client (session auth)
  sync/
    customers.ts                      # Customer sync orchestration
    products.ts                       # Product sync orchestration
    invoices.ts                       # Invoice sync orchestration
    payments.ts                       # Payment sync orchestration
  mappers/
    customer.mapper.ts                # Rubic -> Tripletex customer mapping
    product.mapper.ts                 # Rubic -> Tripletex product mapping
    invoice.mapper.ts                 # Rubic -> Tripletex invoice/order mapping
  db/
    schema.ts                         # Drizzle ORM schema
    client.ts                         # DB connection
    migrations/                       # SQL migration files
  types/
    rubic.ts                          # Rubic API types
    tripletex.ts                      # Tripletex API types
  config.ts                           # Zod-validated environment config
  logger.ts                           # Structured JSON logger
```

## API Endpoints

| Endpoint                          | Method | Auth           | Description              |
| --------------------------------- | ------ | -------------- | ------------------------ |
| `/api/health`                     | GET    | None           | Health check + sync status |
| `/api/cron/sync-customers`        | GET    | CRON_SECRET    | Customer sync (Vercel cron) |
| `/api/cron/sync-products`         | GET    | CRON_SECRET    | Product sync (Vercel cron)  |
| `/api/cron/sync-invoices`         | GET    | CRON_SECRET    | Invoice sync (Vercel cron)  |
| `/api/cron/sync-payments`         | GET    | CRON_SECRET    | Payment sync (Vercel cron)  |
| `/api/trigger/{syncType}`         | POST   | Auth0 session  | Manual sync trigger         |
| `/api/auth/login`                 | GET    | None           | Auth0 login redirect        |
| `/api/auth/logout`                | GET    | Auth0 session  | Auth0 logout                |

## Database Schema

- **sync_state**: Tracks each sync run (type, status, timestamps, record counts, errors)
- **customer_mapping**: Maps Rubic `customerNo` to Tripletex `customerId` with change-detection hash
- **product_mapping**: Maps Rubic `productCode` to Tripletex `productId` with change-detection hash
- **invoice_mapping**: Maps Rubic `invoiceId` to Tripletex `invoiceId` with payment sync status

## Environment Variables

See [`.env.example`](.env.example) for all required variables. Key groups:

- **Database**: `DATABASE_URL`, `DATABASE_URL_UNPOOLED` (Neon Postgres)
- **Rubic**: `RUBIC_API_BASE_URL`, `RUBIC_API_KEY`, `RUBIC_ORGANIZATION_ID`
- **Tripletex**: `TRIPLETEX_API_BASE_URL`, `TRIPLETEX_CONSUMER_TOKEN`, `TRIPLETEX_EMPLOYEE_TOKEN`
- **Auth0**: `AUTH0_SECRET`, `AUTH0_BASE_URL`, `AUTH0_ISSUER_BASE_URL`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`
- **Cron**: `CRON_SECRET` (auto-set by Vercel)
