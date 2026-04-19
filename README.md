# AI Rent

AI Rent is a full-stack rental marketplace for discovering, listing, booking, approving, renting, returning, and reviewing shareable products from one web application.

The system supports four practical user modes:

- `Guest` users who browse public listings and owner profiles
- `Renter` users who request bookings and review completed rentals
- `Owner` users who create listings and manage rental requests
- `Admin` users who moderate the marketplace and monitor system activity

The project is built with:

- `Node.js + Express` for the API and static hosting
- `Python + Flask` for optional AI recommendation scoring
- `React + Vite` for the frontend
- `PostgreSQL + Prisma` for persistence
- `JWT + refresh cookies` for authentication

## Table Of Contents

1. [Project Summary](#project-summary)
2. [Core Features](#core-features)
3. [Technology Stack](#technology-stack)
4. [Architecture Overview](#architecture-overview)
5. [User Roles And Permissions](#user-roles-and-permissions)
6. [Use Cases](#use-cases)
7. [How The System Is Used](#how-the-system-is-used)
8. [Data Model](#data-model)
9. [Diagrams](#diagrams)
10. [API Overview](#api-overview)
11. [Project Structure](#project-structure)
12. [Local Setup](#local-setup)
13. [Environment Variables](#environment-variables)
14. [Available Scripts](#available-scripts)
15. [Testing And Quality Assurance](#testing-and-quality-assurance)
16. [Deployment Guide](#deployment-guide)
17. [Engineering Standards Followed In This Project](#engineering-standards-followed-in-this-project)
18. [Known Constraints And Recommended Next Steps](#known-constraints-and-recommended-next-steps)
19. [GitHub Upload Checklist](#github-upload-checklist)
20. [License](#license)

## Project Summary

AI Rent solves a common marketplace problem: a user should be able to move from discovery to rental fulfillment without switching platforms or workflows.

This repository currently delivers:

- public browsing for categories and products
- product details with reviews and similar-product recommendations
- owner public profile pages with related listings
- profile management, avatar uploads, email verification, and notifications
- wishlist management
- dedicated `Bookings` and `Rentals` pages
- owner listing management and moderation feedback handling
- admin moderation for users, listings, rentals, and reports
- a behavior-driven recommendation engine with optional Flask-based AI scoring
- OpenAPI documentation and automated smoke tests

## Core Features

### Marketplace Features

- browse public listings by keyword, category, and filters
- view product details, pricing, city, owner, images, and reviews
- view similar products and personalized recommendations
- open public owner profiles and browse related owner listings

### Account Features

- user registration and login
- email verification with resend support
- verified-email gate before first successful login
- access token + refresh cookie authentication flow
- password reset flow
- profile update and avatar upload

### Renter Features

- create rental requests
- track personal bookings in a dedicated page
- cancel eligible bookings
- complete post-rental reviews
- save items to a wishlist

### Owner Features

- create, edit, and delete listings
- upload multiple product images
- monitor moderation notes and reply to them
- approve, reject, start, and complete rentals
- track owner-side rentals in a dedicated page

### Admin Features

- inspect marketplace dashboard metrics
- view and update user status
- approve or reject products
- review rental activity
- review aggregate reports

### Intelligence And Personalization

- track user behavior such as views, searches, wishlist actions, rentals, reviews, and recommendation clicks
- compute personalized recommendations from behavior and product signals
- optionally offload recommendation scoring to a Python `Flask` service that applies a TF-IDF-style content model plus marketplace signals
- compute similar products for each product details page

## Technology Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Frontend | React 19, Vite 8 | Multi-page UI, routing by HTML entry pages |
| Backend | Node.js, Express 5 | REST API, auth, static serving, business workflows |
| AI Service | Python, Flask | Recommendation scoring for personalized and similar-product ranking |
| Database | PostgreSQL | Relational data store |
| ORM | Prisma 7 | Schema, migrations, typed database client |
| Authentication | JWT, httpOnly refresh cookie, bcrypt | Login, session refresh, password protection |
| Uploads | Multer, local filesystem | Product and avatar uploads |
| Documentation | OpenAPI, Swagger UI | Interactive API docs |
| Testing | Node-based unit, integration, and smoke scripts | Regression protection |
| Deployment | Docker, standard Node hosting | Production delivery options |

## Architecture Overview

The application is a server-rendered static hosting + API architecture:

```mermaid
flowchart LR
  Browser[Browser Client] --> Frontend[React Pages Built By Vite]
  Frontend --> API[Express API]
  API --> Auth[JWT + Refresh Cookie Auth]
  API --> Recommender[Flask AI Recommender]
  API --> Prisma[Prisma ORM]
  Prisma --> Postgres[(PostgreSQL)]
  API --> Uploads[Local Upload Storage]
  API --> Docs[OpenAPI + Swagger UI]
```

### Runtime Responsibilities

- `frontend/` contains the React UI and HTML page entries
- `src/app.js` creates the Express app, configures middleware, and serves static assets
- `src/routes/` defines the REST API surface
- `src/controllers/` holds business logic
- `src/middlewares/` handles auth and file uploads
- `prisma/schema.prisma` defines the domain model and migrations
- `uploads/` stores avatar and product media on disk

### Request Flow

1. A page or action in the React client calls `/api/v1/...`
2. Express authenticates the request when needed
3. Controllers validate input, run business rules, and query Prisma
4. The database persists or returns the result
5. The frontend updates the UI and, when needed, refreshes auth via the refresh cookie

## User Roles And Permissions

| Role | Description | Main Capabilities |
| --- | --- | --- |
| `guest` | Unauthenticated visitor | Browse public listings, categories, product details, similar products, and public owner profiles |
| `renter` | Authenticated marketplace user | Book products, manage bookings, save wishlist items, review completed rentals |
| `owner` | Listing manager | Create listings, upload images, handle approvals and rental lifecycle |
| `both` | User acting as renter and owner | Can use both renter and owner workflows |
| `admin` | Marketplace operator | Moderate users, products, rentals, and reports |

Notes:

- The schema supports `renter`, `owner`, `both`, and `admin`.
- In practice, a user can move into owner workflows once they create listings.
- Admin access is not self-service. An existing user must be promoted in the database.

## Use Cases

### Main Business Use Cases

- Guest browses categories and available products
- User registers, verifies email, and logs in
- Owner creates a listing and uploads images
- Admin reviews and approves or rejects listings
- Renter requests a rental for an approved listing
- Owner approves or rejects the request
- Owner starts and completes the rental lifecycle
- Renter leaves a review after completion
- System records behavior and improves recommendations

### Use Case Diagram

```mermaid
flowchart LR
  Guest((Guest))
  Renter((Renter))
  Owner((Owner))
  Admin((Admin))

  UC1[Browse listings]
  UC2[View product details]
  UC3[Register / Verify / Login]
  UC4[Manage profile]
  UC5[Save wishlist]
  UC6[Request rental]
  UC7[Track bookings]
  UC8[Create listing]
  UC9[Upload product images]
  UC10[Approve / Reject rental]
  UC11[Start / Complete rental]
  UC12[Leave review]
  UC13[Moderate users]
  UC14[Moderate products]
  UC15[View dashboard]
  UC16[Manage categories]

  Guest --> UC1
  Guest --> UC2
  Guest --> UC3

  Renter --> UC4
  Renter --> UC5
  Renter --> UC6
  Renter --> UC7
  Renter --> UC12

  Owner --> UC4
  Owner --> UC8
  Owner --> UC9
  Owner --> UC10
  Owner --> UC11

  Admin --> UC13
  Admin --> UC14
  Admin --> UC15
  Admin --> UC16
```

## How The System Is Used

### Standard Marketplace Walkthrough

1. A visitor opens the home page and explores recommended and public listings.
2. A user registers an account, receives a verification email, and verifies the email address.
3. The user updates the profile and uploads an avatar.
4. An owner creates a listing from `My Listings`.
5. The admin reviews the listing and approves it.
6. A renter opens the product details page and submits a rental request.
7. The owner manages the request from the `Rentals` page.
8. The renter follows the booking from the `Bookings` page.
9. After completion, the renter leaves a review.
10. Behavior events and marketplace signals improve future recommendations.

### Owner Listing Lifecycle

1. Create a listing
2. Upload images
3. Wait for admin approval
4. Reply to moderation notes if needed
5. Toggle availability
6. Handle rental requests
7. Track completed rentals and reviews

### Rental Lifecycle

1. `pending`
2. `approved` or `rejected`
3. `active`
4. `completed`, `cancelled`, or `overdue`

## Data Model

The domain is centered around users, products, rentals, reviews, and recommendation signals.

### Core Models

| Model | Purpose | Key Relationships |
| --- | --- | --- |
| `User` | Account, identity, role, profile | owns products, rents products, receives notifications, writes reviews |
| `Category` | Marketplace taxonomy | contains many products, optional parent/child nesting |
| `Product` | Rentable item listing | belongs to user and category, has images, rentals, reviews, wishlists |
| `ProductImage` | Listing media | belongs to one product |
| `Rental` | Booking and fulfillment record | links renter, owner, and product |
| `Review` | Rating after rental completion | belongs to one rental and one product |
| `Wishlist` | Saved interest in a product | links one user and one product |
| `Notification` | In-app updates | belongs to one user, optionally linked to a rental |
| `UserBehavior` | Analytics and recommendation signal | belongs to a user and optionally a product/category |
| `AvailabilityCalendar` | Explicit blocked dates | belongs to one product |
| `RefreshToken` | Long-lived auth refresh session | belongs to one user |
| `EmailVerificationToken` | Email confirmation security token | belongs to one user |
| `PasswordResetToken` | Password reset security token | belongs to one user |

### Important Enums

| Enum | Values |
| --- | --- |
| `UserRole` | `renter`, `owner`, `both`, `admin` |
| `ProductStatus` | `available`, `rented`, `unavailable`, `under_review`, `suspended` |
| `ProductCondition` | `new`, `like_new`, `excellent`, `good`, `fair` |
| `RentalStatus` | `pending`, `approved`, `rejected`, `active`, `completed`, `cancelled`, `overdue` |
| `RentalPeriodType` | `hourly`, `daily`, `weekly`, `monthly` |
| `BehaviorAction` | `view`, `search`, `wishlist`, `rent`, `review`, `share`, `click_recommendation` |
| `NotificationType` | rental, review, recommendation, and system event types |
| `UnavailabilityReason` | `maintenance`, `personal_use`, `booked`, `other` |

## Diagrams

### Entity Relationship Diagram

```mermaid
erDiagram
  User ||--o{ Product : owns
  User ||--o{ Rental : renter
  User ||--o{ Rental : owner
  User ||--o{ Review : writes
  User ||--o{ Wishlist : saves
  User ||--o{ Notification : receives
  User ||--o{ UserBehavior : generates
  User ||--o{ RefreshToken : has
  User ||--o{ EmailVerificationToken : has
  User ||--o{ PasswordResetToken : has

  Category ||--o{ Product : classifies
  Category ||--o{ UserBehavior : context
  Category ||--o{ Category : parent_of

  Product ||--o{ ProductImage : contains
  Product ||--o{ Rental : booked_in
  Product ||--o{ Review : reviewed_in
  Product ||--o{ Wishlist : saved_in
  Product ||--o{ UserBehavior : tracked_in
  Product ||--o{ AvailabilityCalendar : blocks

  Rental ||--o| Review : results_in
  Rental ||--o{ Notification : triggers
```

### Domain Class Diagram

```mermaid
classDiagram
  class User {
    +String id
    +String name
    +String email
    +String role
    +Boolean isActive
    +Boolean isVerified
  }

  class Category {
    +String id
    +String name
    +String description
    +Boolean isActive
  }

  class Product {
    +String id
    +String title
    +String status
    +String condition
    +Decimal pricePerDay
    +Decimal avgRating
    +Boolean isApproved
  }

  class ProductImage {
    +String id
    +String imageUrl
    +Boolean isPrimary
  }

  class Rental {
    +String id
    +DateTime startDate
    +DateTime endDate
    +String rentalPeriodType
    +String status
    +Decimal totalPrice
  }

  class Review {
    +String id
    +Int rating
    +String comment
    +String ownerReply
  }

  class Wishlist {
    +String id
    +DateTime createdAt
  }

  class Notification {
    +String id
    +String type
    +String title
    +Boolean isRead
  }

  class UserBehavior {
    +String id
    +String actionType
    +String searchQuery
    +Json metadata
  }

  class AvailabilityCalendar {
    +String id
    +Date unavailableFrom
    +Date unavailableTo
    +String reason
  }

  class EmailVerificationToken {
    +String id
    +String token
    +DateTime expiresAt
    +Boolean isUsed
  }

  User "1" --> "*" Product : owns
  User "1" --> "*" Rental : rents
  User "1" --> "*" Rental : fulfills
  User "1" --> "*" Review : writes
  User "1" --> "*" Wishlist : saves
  User "1" --> "*" Notification : receives
  User "1" --> "*" UserBehavior : generates
  User "1" --> "*" EmailVerificationToken : verifies
  Category "1" --> "*" Product : groups
  Product "1" --> "*" ProductImage : has
  Product "1" --> "*" Rental : booked_in
  Product "1" --> "*" Review : reviewed
  Product "1" --> "*" Wishlist : wished
  Product "1" --> "*" AvailabilityCalendar : blocks
  Rental "1" --> "0..1" Review : produces
```

### Rental Booking Sequence Diagram

```mermaid
sequenceDiagram
  actor R as Renter
  actor O as Owner
  participant UI as React UI
  participant API as Express API
  participant DB as PostgreSQL

  R->>UI: Open product details
  UI->>API: GET /api/v1/products/:id
  API->>DB: Read product, owner, reviews, images
  DB-->>API: Product data
  API-->>UI: Product details

  R->>UI: Submit rental request
  UI->>API: POST /api/v1/rentals
  API->>DB: Validate availability and create pending rental
  DB-->>API: Rental created
  API-->>UI: Rental confirmation

  O->>UI: Open Rentals page
  UI->>API: GET /api/v1/rentals/my-requests
  API->>DB: Load owner requests
  DB-->>API: Requests
  API-->>UI: Requests list

  O->>UI: Approve rental
  UI->>API: PUT /api/v1/rentals/:id/approve
  API->>DB: Update rental status and notifications
  DB-->>API: Approved
  API-->>UI: Approval success

  O->>UI: Start rental
  UI->>API: PUT /api/v1/rentals/:id/start
  API->>DB: Mark rental active
  DB-->>API: Active
  API-->>UI: Start success

  O->>UI: Complete rental
  UI->>API: PUT /api/v1/rentals/:id/complete
  API->>DB: Mark rental completed
  DB-->>API: Completed
  API-->>UI: Completion success

  R->>UI: Leave review
  UI->>API: POST /api/v1/reviews
  API->>DB: Create review and update product rating
  DB-->>API: Review stored
  API-->>UI: Review submitted
```

## API Overview

### Base Paths

- UI pages are served from `/` and `/html/*.html`
- API routes are served from `/api/v1`
- Swagger UI is served from `/api/v1/docs`
- OpenAPI JSON is served from `/api/v1/docs/openapi.json`
- Health check is served from `/healthz`

### Route Groups

| Group | Example Routes | Access |
| --- | --- | --- |
| Auth | `/auth/register`, `/auth/request-email-verification`, `/auth/verify-email`, `/auth/login` | Public plus optional authenticated resend support |
| Users | `/users/me`, `/users/change-password`, `/users/upload-avatar` | Authenticated |
| Public Users | `/public/users/:id`, `/public/users/:id/products` | Public |
| Categories | `/categories`, `/categories/:id` | Public read, admin write |
| Products | `/products`, `/products/:id`, `/products/my-listings` | Mixed |
| Rentals | `/rentals`, `/rentals/my-bookings`, `/rentals/:id/approve` | Authenticated |
| Reviews | `/reviews`, `/reviews/product/:id`, `/reviews/:id/reply` | Mixed |
| Wishlists | `/wishlists`, `/wishlists/:productId`, `/wishlists/owner` | Authenticated |
| Recommendations | `/recommendations`, `/recommendations/similar/:productId` | Authenticated personalized, public similar |
| Behavior | `/behavior/track` | Authenticated |
| Notifications | `/notifications`, `/notifications/unread-count` | Authenticated |
| Admin | `/admin/dashboard`, `/admin/products/:id/approve` | Admin only |

### Authentication Model

- Registration creates the user and issues an email verification token.
- The user must verify the email address before the first successful login.
- In development, register and resend-verification responses also include the raw verification token and verification link for local testing.
- The verification UI is available at `/html/verify-email.html`.
- Login returns a short-lived access token in JSON.
- Login also sets a `refreshToken` httpOnly cookie.
- The frontend stores the access token in browser storage.
- When an authenticated request returns `401`, the frontend attempts `/auth/refresh-token`.
- In production, the refresh cookie is `secure` and uses `sameSite: strict`.

## Project Structure

```text
.
|-- frontend/
|   |-- html/
|   |-- src/
|   |   |-- components/
|   |   |-- lib/
|   |   |-- pages/
|   |   `-- styles/
|   `-- index.html
|-- prisma/
|   |-- migrations/
|   `-- schema.prisma
|-- scripts/
|   |-- integration-test.mjs
|   |-- system-smoke-test.mjs
|   |-- unit-test.mjs
|   `-- testing/
|-- src/
|   |-- app.js
|   |-- controllers/
|   |-- database/
|   |-- docs/
|   |-- generated/
|   |-- middlewares/
|   |-- routes/
|   `-- utils/
|-- uploads/
|   |-- avatars/
|   `-- products/
|-- .env.example
|-- Dockerfile
|-- package.json
|-- prisma.config.js
`-- vite.config.js
```

## Local Setup

### Prerequisites

- Node.js `20.19+`, `22.12+`, or `24+`
- npm `10+`
- PostgreSQL `15+` or compatible hosted Postgres

### 1. Install Dependencies

```bash
npm ci
```

### 2. Create Your Environment File

```bash
cp .env.example .env
```

Then edit `.env` with your real local database connection and secrets.

### 3. Generate Prisma Client

```bash
npm run prisma:generate
```

### 4. Apply Database Migrations

For local development:

```bash
npm run prisma:migrate
```

For production-style migration application:

```bash
npm run prisma:deploy
```

### 5. Start The Backend API

```bash
npm run dev
```

The API runs on `http://localhost:8080` by default.

### 6. Start The Frontend Dev Server

In a second terminal:

```bash
npm run client:dev
```

The Vite UI runs on `http://localhost:5173`.

Vite is already configured to proxy:

- `/api` -> `http://localhost:8080`
- `/uploads` -> `http://localhost:8080`

### 7. Start The Optional AI Recommender Service

In a third terminal on PowerShell:

```bash
npm run ai:install
$env:AI_RECOMMENDER_ENABLED = "true"
npm run ai:start
```

On `cmd.exe`, use:

```bash
set AI_RECOMMENDER_ENABLED=true
npm run ai:start
```

On macOS or Linux, use:

```bash
export AI_RECOMMENDER_ENABLED=true
npm run ai:start
```

The Flask recommender runs on `http://localhost:5050` by default. When the Node API sees `AI_RECOMMENDER_ENABLED=true`, it sends recommendation candidates to the Flask service and falls back to the built-in JavaScript scorer if the service is unavailable.

### 8. Open The Application

- Home page: `http://localhost:5173/`
- Login page: `http://localhost:5173/html/login.html`
- Verify email page: `http://localhost:5173/html/verify-email.html`
- Admin dashboard page: `http://localhost:5173/html/admin-dashboard.html`

### 9. Build And Run The Production Bundle Locally

```bash
npm run build
npm run start:with-build
```

Then open `http://localhost:8080`.

### 10. Create An Admin User

The application does not create an admin account automatically.

Recommended options:

- use Prisma Studio: `npm run prisma:studio`
- or run a database update manually

Example SQL:

```sql
UPDATE "User"
SET "role" = 'admin'
WHERE "email" = 'admin@example.com';
```

## Environment Variables

The current codebase uses the following variables:

| Variable | Required | Example | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | `postgresql://postgres:password@localhost:5432/Rent?schema=public` | PostgreSQL connection string |
| `PORT` | No | `8080` | API server port |
| `NODE_ENV` | Yes | `development` or `production` | Environment mode |
| `JWT_SECRET` | Yes | long random secret | Access token signing secret |
| `REFRESH_TOKEN_SECRET` | Yes | different long random secret | Refresh token signing secret |
| `ACCESS_TOKEN_EXPIRATION` | Yes | `15d` | Access token TTL |
| `REFRESH_TOKEN_EXPIRATION` | Yes | `7d` | Refresh token TTL |
| `APP_BASE_URL` | Recommended | `http://localhost:8080` | Base URL used inside verification links and production CORS |
| `AI_RECOMMENDER_ENABLED` | Optional | `true` | Enables the Flask AI recommender and defaults to `http://127.0.0.1:5050` when no URL is supplied |
| `AI_RECOMMENDER_URL` | Optional | `http://127.0.0.1:5050` | Base URL for the Flask recommendation service |
| `AI_RECOMMENDER_TIMEOUT_MS` | Optional | `1500` | Timeout for Node -> Flask recommendation scoring requests |
| `RAILWAY_PUBLIC_DOMAIN` | Railway auto-provided | `example.up.railway.app` | Railway public hostname used as a fallback when `APP_BASE_URL` is not set |
| `CORS_ALLOWED_ORIGINS` | Optional | `https://www.example.com,https://admin.example.com` | Extra allowed browser origins in production |
| `UPLOADS_DIR` | Optional | `/app/uploads` | Absolute directory used for avatar and product uploads |
| `RESEND_API_KEY` | Recommended on Railway | `re_xxxxx` | Sends mail over Resend's HTTPS API instead of direct SMTP |
| `SMTP_CONNECTION_URL` | Optional alternative | `smtps://user:pass@smtp.example.com:465` | Full SMTP connection URL if your provider gives one |
| `SMTP_HOST` | Recommended for production | `smtp.gmail.com` | SMTP host for email delivery |
| `SMTP_PORT` | Recommended for production | `465` | SMTP port |
| `SMTP_USER` | Recommended for production | `yourgmail@gmail.com` | SMTP username |
| `SMTP_PASS` | Recommended for production | Google app password | SMTP password |
| `SMTP_FROM` | Recommended for production | `AI Rent <yourgmail@gmail.com>` | Sender used for verification and password-reset emails |
| `SMTP_SECURE` | No | `true` | Whether the SMTP transport should use TLS from connect time |

Important production notes:

- set `NODE_ENV=production`
- use strong secrets for both JWT variables
- set `APP_BASE_URL` to your public app URL so verification links and CORS are correct
- set `AI_RECOMMENDER_ENABLED=true` only when the Flask service is deployed and reachable
- set `AI_RECOMMENDER_URL` if the Flask service runs on a different host or port
- on Railway, `RAILWAY_PUBLIC_DOMAIN` is provided automatically and can be used as the fallback public URL
- set `CORS_ALLOWED_ORIGINS` only if you need extra browser origins beyond the main app URL
- set `UPLOADS_DIR` only if you want to override the Railway volume mount path
- on Railway, prefer `RESEND_API_KEY` so email is sent over HTTPS instead of direct SMTP
- configure either `RESEND_API_KEY`, `SMTP_CONNECTION_URL`, or the full `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS` set
- set `SMTP_FROM` so verification emails have a valid sender identity
- for Gmail SMTP, use a Google App Password instead of your normal mailbox password

## Available Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the backend with nodemon |
| `npm run ai:install` | Install Python dependencies for the Flask recommender |
| `npm run ai:start` | Start the Flask AI recommender service |
| `npm run build` | Build the frontend bundle |
| `npm run start` | Start the backend server |
| `npm run start:with-build` | Build frontend, then start backend |
| `npm run client:dev` | Start the Vite development server |
| `npm run client:build` | Build only the client |
| `npm run client:preview` | Preview the built client |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Run development migrations |
| `npm run prisma:deploy` | Apply production migrations |
| `npm run prisma:studio` | Open Prisma Studio |
| `npm run verify:schema` | Confirm required production schema columns exist |
| `npm run start:production` | Generate Prisma client, apply migrations, verify schema, then start the API |
| `npm run test` | Run unit, integration, and smoke tests |
| `npm run test:unit` | Run unit tests |
| `npm run test:integration` | Run integration tests |
| `npm run test:system` | Run the end-to-end smoke test |
| `npm run test:smoke` | Alias of the smoke test |
| `npm run check` | Build and run the smoke test |

## Testing And Quality Assurance

### Automated Validation

- `npm run build` validates the frontend bundle
- `npm run test:unit` validates isolated logic
- `npm run test:integration` validates API behavior
- `npm run test:smoke` validates the critical end-to-end marketplace path

### Smoke Test Coverage

The smoke test currently checks:

- API docs availability
- registration, email verification, and login
- category creation
- product creation and image upload
- admin approval
- public product listing
- rental availability
- booking creation
- rental approval, start, and completion
- review creation
- notifications
- admin dashboard

### Manual QA Checklist

Before release, manually verify:

- responsive layout on home, browse, profile, my listings, bookings, rentals, wishlist, and admin pages
- product image uploads and avatar uploads
- owner public profile links from product details
- notifications badge updates
- booking and rental state transitions
## Deployment Guide

### Recommended Production Topology

For the current codebase, the simplest production setup is:

- one Node/Express service
- one Flask AI recommender service
- one PostgreSQL database
- one persistent volume mounted for `uploads/`
- one public HTTPS domain for the Node app and a private internal URL for the recommender

Using the same origin is strongly recommended because:

- frontend API calls are currently relative
- refresh authentication depends on cookies
- production cookies use secure settings

### Production Checklist

- create a production PostgreSQL database
- set all required environment variables
- use `NODE_ENV=production`
- apply database migrations with `npm run prisma:deploy`
- verify schema compatibility with `npm run verify:schema`
- persist the `uploads/` directory with server storage or a mounted volume
- terminate traffic over HTTPS
- run `npm run check` before release

### Standard Node Deployment

1. Upload the project to your server
2. Install dependencies with `npm ci`
3. Create `.env` from `.env.example`
4. Set production variables
5. Run `npm run prisma:generate`
6. Run `npm run prisma:deploy`
7. Run `npm run verify:schema`
8. Run `npm run build`
9. Start the server with `npm run start:production`

### Docker Deployment

Build the image:

```bash
docker build -t ai-rent .
```

Run the container:

```bash
docker run -p 8080:8080 --env-file .env ai-rent
```

Important note:

- the runtime Docker image is optimized for serving the app
- the container now runs Prisma generate, Prisma migrate deploy, and schema verification before starting the API
- if a required migration is missing, the container should fail fast instead of starting with partially broken endpoints

### Railway Deployment

For Railway, use the repository root with the included [Dockerfile](./Dockerfile).

Recommended Railway setup:

1. Create a PostgreSQL database service.
2. Attach the app service to that database and set `DATABASE_URL`.
3. Add a Railway volume and mount it to `/app/uploads`.
4. Set:
   - `NODE_ENV=production`
   - `JWT_SECRET`
   - `REFRESH_TOKEN_SECRET`
   - `ACCESS_TOKEN_EXPIRATION`
   - `REFRESH_TOKEN_EXPIRATION`
   - `APP_BASE_URL`
   - `CORS_ALLOWED_ORIGINS` if you need extra allowed origins
   - `UPLOADS_DIR` only if you want to override the mounted volume path
   - `RESEND_API_KEY` if you want Railway-safe email delivery over HTTPS
   - `SMTP_HOST`
   - `SMTP_PORT`
   - `SMTP_USER`
   - `SMTP_PASS`
   - `SMTP_FROM`
   - `SMTP_SECURE`
5. For Gmail, enable 2-Step Verification on the Google account and create an App Password.
6. Use the Gmail mailbox address for both `SMTP_USER` and the email inside `SMTP_FROM`.
7. Set:
   - `SMTP_HOST=smtp.gmail.com`
   - `SMTP_PORT=465`
   - `SMTP_SECURE=true`
   - `SMTP_PASS=<your Google App Password>`
8. If Railway SMTP times out, set `RESEND_API_KEY=<your Resend API key>` and keep `SMTP_FROM` set to a verified sender address.
9. Set `APP_BASE_URL=https://<your Railway public domain or custom domain>`.
10. Deploy the latest commit so Railway uses the current Dockerfile.
10. After deploy, open `/healthz`.

Expected healthy response:

- `status: "ok"`
- `database: "up"`
- `schema: "up"`
- `email: "up"`

If Railway shows a healthy container but app pages like `My Listings` fail, check:

- the service is on the latest commit
- Railway did not reuse an old build cache
- the production database received the latest Prisma migrations
- `/healthz` does not report `schema: "mismatch"`
- the volume is mounted and the app can write to the uploads directory
- `APP_BASE_URL` matches the actual HTTPS domain users open in the browser
- Gmail credentials use an App Password, not the normal account password

If `/healthz` returns `schema: "mismatch"`, redeploy after the latest image starts or run:

```bash
npm run prisma:deploy
```

against the Railway production database.

Railway runtime behavior already supported by this codebase:

- if `APP_BASE_URL` is missing, the server falls back to Railway's `RAILWAY_PUBLIC_DOMAIN`
- if `UPLOADS_DIR` is missing, the server falls back to Railway's `RAILWAY_VOLUME_MOUNT_PATH`
- uploaded avatars and product images remain available after redeploy when the volume is mounted

### Reverse Proxy Notes

If you deploy behind Nginx, Caddy, Render, Railway, or a similar platform:

- forward the real HTTPS requests to Node
- keep `/uploads` publicly reachable
- keep the frontend and backend under the same domain when possible
- do not strip cookies on `/api/v1/auth/refresh-token`

### Post-Deployment Verification

After going live, verify:

- `GET /healthz` returns `200`
- `GET /healthz` includes `schema: "up"`
- `GET /api/v1/docs` loads Swagger UI
- registration works
- email verification links open the verify page and succeed
- login works
- refresh token flow works
- file uploads are saved and still available after restart
- admin moderation works
- booking state transitions work

## Engineering Standards Followed In This Project

This repository follows these implementation standards:

- REST-style route grouping by resource
- layered backend organization with routes, controllers, middlewares, docs, and utilities
- relational database modeling with Prisma schema + migrations
- explicit role-based authorization
- JWT access tokens plus secure refresh-cookie flow
- OpenAPI documentation for backend endpoints
- automated unit, integration, and smoke coverage
- environment-based configuration with `.env` and `.env.example`
- responsive frontend layouts with shared design tokens and page-level CSS
- static build output served by the same Express application in production

## Known Constraints And Recommended Next Steps

The application is release-ready for academic/demo deployment, but these are the next improvements I recommend for a more robust production launch:

- move uploads from local disk to cloud object storage such as S3 or Cloudinary
- add a rate limiter for auth and sensitive endpoints
- add CI/CD for build, tests, and deployment
- add centralized logging and error monitoring
- add database backup automation
- add seed or bootstrap tooling for admin creation
- add more explicit observability around emails and rental transitions
- add end-to-end browser UI tests

## GitHub Upload Checklist

Before publishing this repository:

- make sure `.env` is not committed
- keep `.env.example` updated
- review any tracked media files in `uploads/`
- run `npm run check`
- confirm production values are not hardcoded anywhere
- confirm the README matches the deployed behavior
- verify screenshots, reports, or private notes are not accidentally included

## License

This project uses the `ISC` license as declared in `package.json`.
