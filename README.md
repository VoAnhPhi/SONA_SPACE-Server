# SONA SPACE Server

Backend service for **SONA SPACE**, providing REST APIs, PostgreSQL data access, EJS admin dashboard pages, and Socket.IO chatbot features.

## Tech Stack

* Node.js
* Express.js
* PostgreSQL
* EJS
* Socket.IO
* Docker Compose

## Requirements

* Node.js 18+
* npm 8+
* Docker Desktop
* Git

## Getting Started

Install dependencies:

```bash
npm install
```

Create environment files:

```bash
cp .env.example .env
cp .env.db.example .env.db
```

Start PostgreSQL locally:

```bash
docker compose up -d
```

Run the backend in development mode:

```bash
npm run dev
```

Default local URLs:

```text
Backend: http://localhost:3501
API base: http://localhost:3501/api
Health check: http://localhost:3501/health
Admin dashboard: http://localhost:3501
```

## Environment Variables

The backend uses `.env`.

```env
NODE_ENV=development
PORT=3501

PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres123
PGDATABASE=furnitown
PGSSLMODE=disable

JWT_SECRET=change-me
BACKEND_URL=http://localhost:3501
API_URL=http://localhost:3501/api
SITE_URL=http://localhost:5173
```

Docker Compose uses `.env.db`.

```env
POSTGRES_DB=furnitown
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres123
```

Do not commit real production credentials. Store production secrets in the hosting provider environment settings.

## Database

Local PostgreSQL is managed with Docker Compose.

```bash
docker compose up -d
```

The initial schema and seed data are loaded from:

```text
db/init/init.sql
```

PostgreSQL only runs the init file when the database volume is empty.

To reset the local database and reload seed data:

```bash
docker compose down -v
docker compose up -d
```

## Useful Commands

```bash
npm install
npm run dev
npm start
npm run debug
```

Check app boot:

```bash
node -e "require('./app'); console.log('APP_OK'); process.exit(0)"
```

Run QA checks:

```bash
npm run check:mysql-patterns
npm run qa:auth-smoke
npm run qa:day2-contract
npm run qa:day3-contract
npm run qa:day4-contract
```

## Project Structure

```text
SONA_SPACE-Server/
├── app.js
├── bin/
├── config/
├── db/
│   ├── init/
│   ├── furnitown.sql
│   └── transaction.js
├── middleware/
├── routes/
├── services/
├── public/
├── views/
├── docker-compose.yml
├── package.json
└── README.md
```

## Main Areas

The backend includes:

* Customer REST APIs under `/api`
* Admin dashboard pages under `/dashboard`
* Authentication and user management
* Product, category, order, payment, coupon, comment, news, banner, material, notification, and revenue modules
* Chatbot endpoints using Socket.IO

## Local Review Accounts

Local seed data includes admin and staff accounts for development review.

For account details, see:

```text
docs/local-setup.md
```

## Documentation

Additional planning, migration, and QA documents are available in:

```text
docs/
docs/sprints/
```

Key documents:

* `docs/migration-tracker.md`
* `docs/db-contract-postgres.md`
* `docs/qa-qc-route-regression-playbook.md`
* `docs/sprints/sprint-17-route-qaqc-full-coverage.md`

## Troubleshooting

Common local issues are documented in:

```text
docs/local-setup.md
```

Useful checks:

```bash
docker compose ps
docker compose logs postgres
```

If PostgreSQL seed changes do not appear, reset the local database:

```bash
docker compose down -v
docker compose up -d
```