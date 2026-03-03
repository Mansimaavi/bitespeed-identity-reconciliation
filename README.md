## 🚀 Live API Endpoint

**Base URL:** `https://bitespeed-identity-reconciliation-728c.onrender.com`

### Quick Test
```bash
curl -X POST https://bitespeed-identity-reconciliation-728c.onrender.com/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "phoneNumber": "123456"}'
```

---

# Bitespeed Identity Reconciliation

Backend service that reconciles customer identities based on email and phone number via a `POST /identify` endpoint. Built for the Bitespeed Backend Task.

## ✨ Features

- **Identity Linking**: Automatically links contacts sharing email or phone
- **Smart Merging**: Merges separate identity chains when a connection is discovered
- **Transactional Safety**: All operations run in database transactions for consistency
- **Input Validation**: Validates and normalizes input (trims whitespace, handles null/empty)
- **Flexible Input**: Accepts `phoneNumber` as string or number
- **CORS Enabled**: Ready for cross-origin requests
- **Health Check**: `/health` endpoint for monitoring
- **Request Logging**: Development logging for debugging
- **Comprehensive Tests**: Unit tests for domain logic and service layer

## Tech Stack

- **Node.js 18+** + **TypeScript**
- **Express.js** (REST API)
- **PostgreSQL** via **Prisma ORM**
- **Jest** for testing
- Ready for deployment on **Render**

## Project Structure

```
src/
  config/        # Environment configuration
  controllers/   # Request handlers
  services/      # Business logic (reconciliation)
  routes/        # API routes
  middleware/    # Error handling, etc.
  prisma/        # Prisma client
  types/         # TypeScript types
  utils/         # Helpers, errors
prisma/
  schema.prisma  # Database schema
```

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL database

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and set your database URL:

```bash
cp .env.example .env
```

Edit `.env`:

```
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public"
PORT=3000
```

### 3. Run database migrations

```bash
npm run prisma:migrate
```

This creates the `Contact` table and applies migrations.

### 4. Generate Prisma client

```bash
npm run prisma:generate
```

(Run automatically after migrate, but can be used standalone.)

## Local Run

**Development** (with hot reload):

```bash
npm run dev
```

**Production build**:

```bash
npm run build
npm start
```

Server listens on `PORT` (default 3000).

## API

### `POST /identify`

Reconciles a contact by email and/or phone.

**Request body:**

```json
{
  "email": "user@example.com",
  "phoneNumber": "+1234567890"
}
```

At least one of `email` or `phoneNumber` is required.

**Response (200):**

```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["user@example.com"],
    "phoneNumbers": ["+1234567890"],
    "secondaryContactIds": [2, 3]
  }
}
```

### `GET /health`

Health check for load balancers and monitoring.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### `GET /`

API information endpoint.

### Error Responses

**400 Bad Request** - Validation error:
```json
{
  "error": "At least one of email or phoneNumber must be provided",
  "code": "VALIDATION_ERROR"
}
```

**500 Internal Server Error**:
```json
{
  "error": "Internal server error",
  "code": "INTERNAL_ERROR"
}
```

---

## Deployment on Render

### 1. Create PostgreSQL database

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. **New** → **PostgreSQL**
3. Create the database and copy the **Internal Database URL**

### 2. Create Web Service

1. **New** → **Web Service**
2. Connect your Git repository
3. Use these settings (or rely on `render.yaml` if using Blueprint):

| Setting         | Value                                           |
|-----------------|-------------------------------------------------|
| Build Command   | `npm install && npm run build`                  |
| Start Command   | `npx prisma migrate deploy && npm start`        |
| Environment     | Add `DATABASE_URL` = your PostgreSQL URL        |
|                 | `NODE_ENV` = `production` (optional)            |

**Important:** Add `DATABASE_URL` in **Environment** → **Add Environment Variable**.

### 3. Deploy

Render will build and start the service. It will be available at:

`https://<your-service-name>.onrender.com`

### Scripts reference

| Script        | Purpose                                  |
|---------------|------------------------------------------|
| `npm run build` | Install Prisma client + compile TypeScript |
| `npm start`   | Run production server (`node dist/index.js`) |

---

## Reconciliation Logic

| Case | Scenario | Action |
|------|----------|--------|
| 1 | No existing contact matches | Create new **PRIMARY** contact |
| 2 | Matching contact exists + new info (email/phone) | Create **SECONDARY** linked to primary |
| 3 | Two primary contacts become linked (e.g. email matches A, phone matches B) | **Merge**: oldest stays PRIMARY, newer becomes SECONDARY |

- Contacts are linked when **email** OR **phoneNumber** matches.
- The oldest contact (by `createdAt`) is PRIMARY; others are SECONDARY.
- Response lists primary email/phone first, then secondary, with duplicates removed.
