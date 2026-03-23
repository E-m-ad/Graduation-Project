# AI Rent

AI Rent is an **AI-powered smart rental platform** that allows users to **list, discover, request, rent, return, and review items** through one unified system. The platform is designed for multiple rental categories such as **vehicles, electronics, tools, and apartments**, with a focus on smarter discovery, secure workflows, and a more sustainable sharing economy.

## Project Overview

AI Rent is built as a cross-platform rental marketplace where:

- **Renters** can browse listings, search and filter items, request rentals, add products to their wishlist, and leave reviews after completed rentals.
- **Owners** can create and manage listings, upload images, approve or reject rental requests, and manage rental states.
- **Admins** can moderate listings, manage users and categories, inspect rentals, and monitor the system.

The platform also includes an **AI recommendation engine** that learns from user behavior such as views, searches, wishlists, rentals, and reviews to provide personalized recommendations and similar-item suggestions.

## Tech Stack

### Mobile Application
- Flutter

### Backend API
- Node.js
- Express.js

### Database
- PostgreSQL
- Prisma ORM

### Authentication & Security
- JWT
- bcrypt

### AI Service
- Python
- Flask

### Storage & Notifications
- Cloudinary or AWS S3
- Firebase Cloud Messaging (FCM)

### Deployment & Version Control
- Docker
- Render or Railway
- Git & GitHub

## Core Features

- User registration, login, logout, refresh token rotation, and profile management
- Role-based access control for **Renter**, **Owner**, and **Admin**
- Product listing management with multiple images
- Category management
- Product browsing, keyword search, filtering, sorting, and pagination
- Rental request workflow with approval, rejection, availability checks, and lifecycle tracking
- Ratings and reviews after completed rentals
- Wishlist / favorites
- Notifications system
- Admin dashboard and moderation endpoints
- AI recommendations for home feed and similar products
- Dockerized deployment and API documentation

## User Roles

### Guest
- Register and log in
- Browse public listings
- View categories

### Renter
- Search and filter products
- Add products to wishlist
- Request rentals
- Cancel eligible bookings
- Review completed rentals

### Owner
- Create, edit, and delete listings
- Upload listing images
- Approve or reject rental requests
- Mark rental states

### Admin
- Manage users
- Manage listings
- Manage categories
- Inspect rentals
- Review reports and moderate platform activity

## High-Level Architecture

The project follows a **client-server architecture** with a **modular backend** and a separate **AI microservice**.

```text
Flutter Mobile App  <----HTTPS / JSON---->  Node.js / Express API
                                                |
                                                |---- PostgreSQL
                                                |---- Image Storage
                                                |---- FCM / Email
                                                |
                                                |---- Python Flask AI Service
```

### Backend Layering

```text
Routes -> Controllers -> Services -> Repositories -> Database
                                     -> External Services
```

This structure helps keep the system maintainable, scalable, and easier to test.

## Main Modules

- **Authentication & User Profile**
- **Product Listing Management**
- **Search, Browse, and Filter**
- **Rental and Booking Workflow**
- **Review and Rating System**
- **Wishlist Module**
- **Notification Module**
- **Admin Module**
- **AI Recommendation Module**

## Rental Workflow

1. Renter opens a product detail page
2. Renter selects rental dates
3. Backend checks availability and overlapping rentals
4. Renter submits rental request
5. Owner receives a notification
6. Owner approves or rejects the request
7. If approved, the dates become reserved
8. Owner marks the rental as active when it starts
9. Owner marks the rental as completed after return
10. Renter becomes eligible to leave a rating and review

## API Overview

Base URL:

```text
/api/v1
```

Main endpoint groups:

- `auth`
- `users`
- `products`
- `categories`
- `rentals`
- `reviews`
- `wishlists`
- `recommendations`
- `behavior`
- `notifications`
- `admin`

## AI Recommendation Engine

The recommendation engine is designed to improve discovery and conversion using:

- **Content-based filtering**
- **Collaborative filtering**
- **Hybrid recommendation scoring**

It uses behavior signals such as:

- Product views
- Search events
- Wishlist additions
- Completed rentals
- Reviews
- Recommendation clicks

## Suggested Project Structure

```text
src/
  app.js
  server.js
  config/
  routes/
  controllers/
  services/
  repositories/
  middlewares/
  validators/
  utils/
  modules/
    auth/
    users/
    categories/
    products/
    rentals/
    reviews/
    wishlists/
    notifications/
    admin/
    recommendations/
prisma/
tests/
```

## Environment Variables

Create a `.env` file and add your environment variables.

Example:

```env
DATABASE_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
ACCESS_TOKEN_EXPIRES_IN=
REFRESH_TOKEN_EXPIRES_IN=
CLOUDINARY_URL=
FCM_SERVER_KEY=
AI_SERVICE_URL=
PORT=
NODE_ENV=
```

> Do not commit your real `.env` file to GitHub.

## Development Plan

Suggested implementation order:

1. Authentication and user module
2. Categories and products
3. Media upload
4. Search and filtering
5. Rentals and availability
6. Notifications
7. Reviews and wishlist
8. Admin tools
9. AI recommendation service
10. Deployment and quality assurance

## Testing

Recommended testing tools:

- Jest
- Supertest
- Postman or Bruno
- Flutter widget and integration tests
- pytest for the Flask AI service

## Future Enhancements

- Online payment gateway
- Real-time chat between renter and owner
- Map-based discovery
- Identity verification and trust scores
- Delivery tracking
- Insurance and damage claim workflow
- Advanced analytics dashboard
- Multilingual support
- Demand-based pricing
- Stronger machine learning models

## Documentation

This README was prepared from the project documentation and refined project specification.

## Author

Add your name here.

## License

This project is for academic / graduation project purposes.
# AI Rent — UML & Architecture Diagrams.

## 1) Use Case Diagram

```mermaid
flowchart LR
  %% Actors
  Guest([Guest])
  Renter([Renter])
  Owner([Owner])
  Admin([Admin])

  subgraph System[AI RENT SYSTEM]
    direction LR

    subgraph Auth[Authentication]
      UC_Register((Register))
      UC_Login((Login))
      UC_Forgot((Forgot Password))
      UC_Reset((Reset Password))
    end

    subgraph RenterFeatures[Renter Features]
      UC_Browse((Browse Listings))
      UC_Search((Search & Filter))
      UC_View((View Product Details))
      UC_Request((Request Rental))
      UC_Cancel((Cancel Booking))
      UC_MyBookings((View My Bookings))
      UC_Rate((Rate & Review))
      UC_Wishlist((Manage Wishlist))
      UC_Recommendations((View Recommendations))
      UC_RenterNotif((View Notifications))
      UC_EditProfileR((Edit Profile))
    end

    subgraph OwnerFeatures[Owner Features]
      UC_CreateListing((Create Listing))
      UC_EditListing((Edit Listing))
      UC_DeleteListing((Delete Listing))
      UC_UploadImages((Upload Product Images))
      UC_Pricing((Set Pricing Tiers))
      UC_UpdateStatus((Update Listing Status))
      UC_ViewRequests((View Rental Requests))
      UC_Approve((Approve Rental))
      UC_Reject((Reject Rental))
      UC_Start((Mark Rental Started))
      UC_Complete((Mark Rental Completed))
      UC_ReplyReview((Reply to Review))
      UC_OwnerNotif((View Notifications))
      UC_EditProfileO((Edit Profile))
    end

    subgraph AdminFeatures[Admin Features]
      UC_Dashboard((View Dashboard))
      UC_ManageUsers((Manage Users))
      UC_Activate((Activate/Suspend User))
      UC_Categories((Manage Categories))
      UC_ApproveListing((Approve Listing))
      UC_RejectListing((Reject Listing))
      UC_AllRentals((View All Rentals))
      UC_Reports((View System Reports))
      UC_ManageAllListings((Manage All Listings))
    end

    subgraph SystemAuto["SYSTEM - Automated"]
      UC_GenRecs((Generate Recommendations))
      UC_Track((Track User Behavior))
      UC_SendNotif((Send Notifications))
      UC_CalcPrice((Calculate Rental Price))
      UC_CheckAvail((Check Availability))
      UC_UpdateAvail((Update Listing Availability))
      UC_ComputeRating((Compute Average Rating))
    end
  end

  %% Associations
  Guest --- UC_Register
  Guest --- UC_Login
  Renter --- UC_Browse
  Renter --- UC_Search
  Renter --- UC_View
  Renter --- UC_Request
  Renter --- UC_Cancel
  Renter --- UC_MyBookings
  Renter --- UC_Rate
  Renter --- UC_Wishlist
  Renter --- UC_Recommendations
  Renter --- UC_RenterNotif
  Renter --- UC_EditProfileR

  Owner --- UC_CreateListing
  Owner --- UC_EditListing
  Owner --- UC_DeleteListing
  Owner --- UC_UploadImages
  Owner --- UC_Pricing
  Owner --- UC_UpdateStatus
  Owner --- UC_ViewRequests
  Owner --- UC_Approve
  Owner --- UC_Reject
  Owner --- UC_Start
  Owner --- UC_Complete
  Owner --- UC_ReplyReview
  Owner --- UC_OwnerNotif
  Owner --- UC_EditProfileO

  Admin --- UC_Dashboard
  Admin --- UC_ManageUsers
  Admin --- UC_Activate
  Admin --- UC_Categories
  Admin --- UC_ApproveListing
  Admin --- UC_RejectListing
  Admin --- UC_AllRentals
  Admin --- UC_Reports
  Admin --- UC_ManageAllListings
```

---

## 2) Class Diagram

```mermaid
classDiagram
  class User {
    +UUID id
    +String email
    +String passwordHash
    +String fullName
    +String phone
    +String avatarUrl
    +String address
    +Role role
    +AccountStatus status
    +DateTime createdAt
    +DateTime updatedAt
    +register()
    +login(): Token
    +updateProfile()
    +changePassword()
    +resetPassword()
  }

  class Category {
    +UUID id
    +String name
    +String description
    +String icon
    +Boolean isActive
    +DateTime createdAt
    +DateTime updatedAt
  }

  class Product {
    +UUID id
    +String title
    +String description
    +UUID categoryId
    +UUID ownerId
    +Decimal pricePerHour
    +Decimal pricePerDay
    +Decimal pricePerWeek
    +Decimal pricePerMonth
    +Condition condition
    +String city
    +Decimal latitude
    +Decimal longitude
    +String terms
    +ModerationStatus moderationStatus
    +AvailabilityStatus availabilityStatus
    +Decimal averageRating
    +Int totalReviews
    +DateTime createdAt
    +DateTime updatedAt
    +calculatePrice(duration): Decimal
    +updateAvailability()
    +computeAverageRating()
  }

  class ProductImage {
    +UUID id
    +UUID productId
    +String imageUrl
    +Boolean isPrimary
    +Int displayOrder
    +DateTime createdAt
  }

  class Wishlist {
    +UUID id
    +UUID userId
    +UUID productId
    +DateTime createdAt
    +add()
    +remove()
  }

  class Review {
    +UUID id
    +UUID productId
    +UUID renterId
    +UUID rentalId
    +Int rating
    +String comment
    +String ownerReply
    +DateTime createdAt
    +create()
    +update()
    +reply()
    +delete()
  }

  class Rental {
    +UUID id
    +UUID productId
    +UUID renterId
    +UUID ownerId
    +DateTime startAt
    +DateTime endAt
    +PricingTier pricingTier
    +Decimal totalPrice
    +RentalStatus status
    +String cancellationReason
    +CancelledBy cancelledBy
    +DateTime createdAt
    +DateTime updatedAt
    +approve()
    +reject()
    +cancel()
    +start()
    +complete()
    +calculateTotal(): Decimal
  }

  class Notification {
    +UUID id
    +UUID userId
    +String title
    +String message
    +NotificationType type
    +Boolean isRead
    +DateTime createdAt
    +markAsRead()
  }

  class UserBehavior {
    +UUID id
    +UUID userId
    +UUID productId
    +EventType eventType
    +String searchQuery
    +Int weight
    +DateTime createdAt
    +track()
  }

  class Recommendation {
    +UUID id
    +UUID userId
    +UUID productId
    +Decimal score
    +Algorithm algorithm
    +DateTime createdAt
    +generate() ListOfRecommendation
    +getSimilar(productId) ListOfProduct
  }

  %% Enums
  class Role {
    <<enumeration>>
    RENTER
    OWNER
    ADMIN
  }
  class AccountStatus {
    <<enumeration>>
    ACTIVE
    SUSPENDED
  }
  class Condition {
    <<enumeration>>
    NEW
    GOOD
    FAIR
  }
  class ModerationStatus {
    <<enumeration>>
    PENDING
    APPROVED
    REJECTED
  }
  class AvailabilityStatus {
    <<enumeration>>
    AVAILABLE
    UNAVAILABLE
  }
  class PricingTier {
    <<enumeration>>
    HOURLY
    DAILY
    WEEKLY
    MONTHLY
  }
  class RentalStatus {
    <<enumeration>>
    PENDING
    APPROVED
    ACTIVE
    COMPLETED
    CANCELLED
    REJECTED
  }
  class CancelledBy {
    <<enumeration>>
    RENTER
    OWNER
    SYSTEM
  }
  class NotificationType {
    <<enumeration>>
    RENTAL_REQUEST
    RENTAL_APPROVED
    RENTAL_REJECTED
    RENTAL_REMINDER
    RECOMMENDATION
  }
  class EventType {
    <<enumeration>>
    VIEW
    SEARCH
    WISHLIST_ADD
    RENTAL_COMPLETE
    REVIEW
    RECOMMENDATION_CLICK
  }
  class Algorithm {
    <<enumeration>>
    CONTENT_BASED
    COLLABORATIVE
    HYBRID
    POPULAR
  }

  %% Relationships
  User "1" -- "*" Notification : receives
  User "1" -- "*" Wishlist : saves
  User "1" -- "*" UserBehavior : generates
  User "1" -- "*" Recommendation : gets
  User "1" -- "*" Rental : renter
  User "1" -- "*" Product : owns
  Product "1" -- "*" ProductImage : has
  Product "1" -- "*" Review : receives
  Product "1" -- "*" Rental : requested for
  Review "*" -- "1" Rental : about
  Category "1" -- "*" Product : categorizes
```

---

## 3) Sequence Diagrams

### 3.1 User Registration

```mermaid
sequenceDiagram
  autonumber
  participant C as Client
  participant R as AuthRouter
  participant Ctrl as AuthController
  participant Svc as AuthService
  participant DB as Database

  C->>R: POST /auth/register {email, password, fullName, phone}
  R->>Ctrl: register(req, res)
  Ctrl->>Ctrl: validateInput()
  Ctrl->>Svc: registerUser(data)
  Svc->>DB: findByEmail(email)
  DB-->>Svc: null (not found)
  Svc->>Svc: hashPassword()
  Svc->>DB: createUser()
  DB-->>Svc: user
  Svc->>Svc: generateJWT()
  Svc-->>Ctrl: {user, token}
  Ctrl-->>R: 201 Created
  R-->>C: {success: true, data: {user, token}}
```

### 3.2 Rental Booking Flow

```mermaid
sequenceDiagram
  autonumber
  participant U as Renter
  participant RR as RentalRouter
  participant RC as RentalController
  participant RS as RentalService
  participant DB as Database
  participant N as Notification

  U->>RR: POST /rentals {productId, startAt, endAt, pricingTier}
  RR->>RR: authMiddleware()
  RR->>RC: createRental()
  RC->>RS: createRental(data)
  RS->>DB: getProduct(productId)
  DB-->>RS: product
  RS->>DB: checkAvailability(productId, range)
  DB-->>RS: available
  RS->>RS: calculateTotal()
  RS->>DB: createRental(...)
  DB-->>RS: rental
  RS->>N: notifyOwner(rental)
  RS-->>RC: rental
  RC-->>RR: 201 Created
  RR-->>U: {success: true, data: rental}
```

### 3.3 AI Recommendation Flow

```mermaid
sequenceDiagram
  autonumber
  participant C as Client
  participant RR as RecommendationRouter
  participant RC as RecommendationController
  participant API as Node.js API
  participant ML as Flask ML Service
  participant DB as Database

  C->>RR: GET /recommendations
  RR->>RC: getRecommendations()
  RC->>API: getUserBehavior(userId)
  API->>DB: fetchBehavior(userId)
  DB-->>API: behaviorData
  API->>ML: POST /recommend {userId, data}
  ML->>DB: fetchProducts()
  DB-->>ML: products
  ML->>ML: contentBased, collaborative, hybridMerge
  ML-->>API: rankedProducts
  API-->>RC: recommendations
  RC-->>RR: 200 OK
  RR-->>C: {success: true, data: [products]}
```

### 3.4 Owner Approves Rental

```mermaid
sequenceDiagram
  autonumber
  participant O as Owner
  participant RR as RentalRouter
  participant RC as RentalController
  participant RS as RentalService
  participant DB as Database
  participant N as Notification

  O->>RR: PUT /rentals/:id/approve
  RR->>RR: authMiddleware()+ownerCheck()
  RR->>RC: approveRental()
  RC->>RS: approve(rentalId)
  RS->>DB: getRental(rentalId)
  DB-->>RS: rental
  RS->>RS: validate(status == PENDING)
  RS->>DB: updateStatus(APPROVED)
  RS->>DB: updateProductAvailability()
  RS->>N: notifyRenter()
  RS-->>RC: updatedRental
  RC-->>RR: 200 OK
  RR-->>O: {success: true, data: rental}
```

---

## 4) Activity Diagrams

### 4.1 Rental Lifecycle

```mermaid
flowchart TD
  A([Start]) --> B[Browse/Search Products]
  B --> C[View Product Detail]
  C --> D["Select Dates & Pricing Tier"]
  D --> E[System Checks Availability]
  E -->|Available| F["Create Rental - PENDING"]
  E -->|Not Available| G[["Show error: dates not available"]]
  F --> H[Notify Owner]
  H --> I[Owner Reviews Request]
  I --> J{Approve?}
  J -->|Yes| K["Status: APPROVED / Notify Renter"]
  J -->|No| L["Status: REJECTED / Notify Renter"]
  K --> M["Owner marks ACTIVE - handover"]
  M --> N[Rental in Progress]
  N --> O{Renter Cancels?}
  O -->|Yes| P["Status: CANCELLED - apply policy"]
  O -->|No| Q["Owner marks COMPLETED - returned"]
  P --> R[Update Product Availability]
  Q --> R[Update Product Availability]
  R --> S[Renter leaves Review]
  S --> T([End])
```

### 4.2 AI Recommendation Generation

```mermaid
flowchart TD
  A([Start]) --> B["Track interactions: view, search, wishlist, rent, review"]
  B --> C[Persist in UserBehavior]
  C --> D{Enough data?}
  D -->|No| E[Popularity-based fallback]
  D -->|Yes| F[Build user profile]
  F --> G[Content-Based Filtering]
  G --> H[Collaborative Filtering]
  H --> I["Hybrid Merge - weighted"]
  E --> J[Rank & Return Top N]
  I --> J
  J --> K[Display on Home/Detail]
  K --> L([End])
```

---

## 5) State Machine Diagrams

### 5.1 Rental Status States

```mermaid
stateDiagram-v2
  [*] --> PENDING
  PENDING --> APPROVED: Owner approves
  PENDING --> REJECTED: Owner rejects
  APPROVED --> ACTIVE: Owner starts
  APPROVED --> CANCELLED: Renter/Owner cancels
  ACTIVE --> COMPLETED: Owner marks completed
  COMPLETED --> [*]
  REJECTED --> [*]
  CANCELLED --> [*]
```

### 5.2 Product Status States

```mermaid
stateDiagram-v2
  [*] --> PENDING: New listing (awaiting review)
  PENDING --> APPROVED: Admin approves
  PENDING --> REJECTED: Admin rejects
  APPROVED --> AVAILABLE: Owner sets available
  AVAILABLE --> UNAVAILABLE: Owner sets unavailable
  UNAVAILABLE --> AVAILABLE: Owner sets available
  REJECTED --> [*]
```

### 5.3 User Account Status States

```mermaid
stateDiagram-v2
  [*] --> ACTIVE
  ACTIVE --> SUSPENDED: Admin suspends
  SUSPENDED --> ACTIVE: Admin reactivates
  ACTIVE --> [*]
```

---

## 6) Component Diagram

```mermaid
flowchart LR
  subgraph Mobile[Flutter Mobile App]
    AuthUI[Auth Screens]
    ProductUI[Product Screens]
    RentalUI[Rental Screens]
    ProfileUI[Profile]
    WishlistUI[Wishlist]
    ReviewUI[Review]
    StateMgmt["State Management - Provider/Riverpod/BLoC"]
  end

  subgraph AdminPanel[Admin Web Panel]
    Dashboard[Dashboard]
    UserMgmt[User Mgmt]
    ProductMgmt[Product Mgmt]
    RentalMgmt[Rental Mgmt]
  end

  subgraph API["Node.js/Express Backend"]
    subgraph Middleware[Middleware]
      MWAuth[Auth]
      MWValidate[Validation]
      MWRate[Rate Limiter]
      MWError[Error Handler]
    end
    subgraph Routes[Routes]
      RAuth[Auth]
      RProd[Product]
      RRent[Rental]
      RRev[Review]
      RWish[Wishlist]
      RAdmin[Admin]
      RRecom[Recommendation]
      RNotif[Notification]
    end
    subgraph Controllers[Controllers]
      CAuth[Auth]
      CProd[Product]
      CRent[Rental]
      CRev[Review]
      CWish[Wishlist]
      CAdmin[Admin]
      CRecom[Recommendation]
      CNotif[Notification]
    end
    subgraph Services[Services]
      SAuth[Auth]
      SProd[Product]
      SRent[Rental]
      SRev[Review]
      SNotif[Notification]
      SBehav[Behavior]
    end
    subgraph Repo["Repository - Prisma"]
      URepo[User]
      PRepo[Product]
      RRepo[Rental]
      RevRepo[Review]
      WRepo[Wishlist]
      BRepo[Behavior]
    end
  end

  subgraph DBs["Data and ML"]
    PG[(PostgreSQL)]
    subgraph ML["Python Flask ML Service"]
      CB[Content-Based]
      CF[Collaborative]
      HY[Hybrid Merger]
    end
  end

  Cloudinary[(Cloudinary / S3)]
  FCM[(Firebase Cloud Messaging)]

  Mobile -- HTTPS/JSON --> API
  AdminPanel -- HTTPS/JSON --> API
  API -- SQL --> PG
  API -- Fetch --> Cloudinary
  API -- Push --> FCM
  API -- HTTP --> ML
```

---

## 7) Deployment Diagram

```mermaid
flowchart LR
  subgraph Clients[Client Devices]
    Android["Android Device - Flutter APK"]
    iOS["iOS Device - Flutter IPA"]
  end

  subgraph Cloud["CLOUD INFRASTRUCTURE - Railway/Render"]
    subgraph NodeC["Docker: Node.js/Express API"]
      NPort[Port 3000]
      NEnv["Env: Production"]
    end
    subgraph FlaskC["Docker: Python/Flask ML"]
      FPort[Port 5000]
    end
    PG[("Managed PostgreSQL<br/>Port 5432<br/>Backups, Pooling")]
  end

  Cloudinary[(Cloudinary / AWS S3)]
  FCM[(Firebase Cloud Messaging)]
  SMTP[(SMTP Email Service)]

  Android -- HTTPS --> NodeC
  iOS -- HTTPS --> NodeC
  NodeC -- internal net --> FlaskC
  NodeC -- SQL --> PG
  NodeC -- HTTPS --> Cloudinary
  NodeC -- HTTPS --> FCM
  NodeC -- SMTP --> SMTP
```

---

## 8) ERD (Entity‑Relationship Diagram)

```mermaid
erDiagram
  USERS ||--o{ PRODUCTS : owns
  USERS ||--o{ RENTALS : rents
  USERS ||--o{ REVIEWS : writes
  USERS ||--o{ WISHLISTS : saves
  USERS ||--o{ NOTIFICATIONS : receives
  USERS ||--o{ USER_BEHAVIORS : generates
  USERS ||--o{ RECOMMENDATIONS : gets

  CATEGORIES ||--o{ PRODUCTS : categorizes
  PRODUCTS ||--o{ PRODUCT_IMAGES : has
  PRODUCTS ||--o{ RENTALS : for
  PRODUCTS ||--o{ REVIEWS : receives
  PRODUCTS ||--o{ WISHLISTS : appears_in
  RENTALS ||--|| REVIEWS : has_one

  USERS {
    UUID id PK
    VARCHAR email
    TEXT password
    VARCHAR full_name
    VARCHAR phone
    TEXT avatar_url
    TEXT address
    ENUM role
    ENUM status
    TIMESTAMP created_at
    TIMESTAMP updated_at
  }
  CATEGORIES {
    UUID id PK
    VARCHAR name
    TEXT description
    VARCHAR icon
    BOOLEAN is_active
    TIMESTAMP created_at
    TIMESTAMP updated_at
  }
  PRODUCTS {
    UUID id PK
    UUID owner_id FK
    UUID category_id FK
    VARCHAR title
    TEXT description
    DECIMAL price_per_hour
    DECIMAL price_per_day
    DECIMAL price_per_week
    DECIMAL price_per_month
    ENUM condition
    VARCHAR city
    DECIMAL latitude
    DECIMAL longitude
    TEXT terms
    ENUM moderation_status
    ENUM availability_status
    DECIMAL average_rating
    INTEGER total_reviews
    TIMESTAMP created_at
    TIMESTAMP updated_at
  }
  PRODUCT_IMAGES {
    UUID id PK
    UUID product_id FK
    TEXT image_url
    BOOLEAN is_primary
    INT display_order
    TIMESTAMP created_at
  }
  WISHLISTS {
    UUID id PK
    UUID user_id FK
    UUID product_id FK
    TIMESTAMP created_at
  }
  REVIEWS {
    UUID id PK
    UUID product_id FK
    UUID renter_id FK
    UUID rental_id FK
    INT rating
    TEXT comment
    TEXT owner_reply
    TIMESTAMP created_at
  }
  RENTALS {
    UUID id PK
    UUID product_id FK
    UUID renter_id FK
    UUID owner_id FK
    TIMESTAMP start_at
    TIMESTAMP end_at
    ENUM pricing_tier
    DECIMAL total_price
    ENUM status
    TEXT cancellation_reason
    ENUM cancelled_by
    TIMESTAMP created_at
    TIMESTAMP updated_at
  }
  NOTIFICATIONS {
    UUID id PK
    UUID user_id FK
    VARCHAR title
    TEXT message
    ENUM type
    BOOLEAN is_read
    TIMESTAMP created_at
  }
  USER_BEHAVIORS {
    UUID id PK
    UUID user_id FK
    UUID product_id FK
    ENUM event_type
    VARCHAR search_query
    INT weight
    TIMESTAMP created_at
  }
  RECOMMENDATIONS {
    UUID id PK
    UUID user_id FK
    UUID product_id FK
    DECIMAL score
    ENUM algorithm
    TIMESTAMP created_at
  }
```

---

## 9) Package Diagram (Backend)

```mermaid
flowchart TB
  subgraph srcDir["src/"]
    subgraph configDir["config/"]
      DB[database.js]
      ENV[env.js]
      CDN[cloudinary.js]
      FCM[firebase.js]
    end
    subgraph middlewareDir["middleware/"]
      MAuth[auth.js]
      MVal[validate.js]
      MRate[rateLimiter.js]
      MErr[errorHandler.js]
      MRole[roleGuard.js]
    end
    subgraph utilsDir["utils/"]
      UResp[response.js]
      UJwt[jwt.js]
      UHash[hash.js]
      UPag[pagination.js]
      UEmail[email.js]
    end

    subgraph modulesDir["modules/"]
      subgraph authDir["auth/"]
        A1[auth.routes.js]
        A2[auth.controller.js]
        A3[auth.service.js]
        A4[auth.repository.js]
        A5[auth.validation.js]
      end
      subgraph productDir["product/"]
        P1[product.routes.js]
        P2[product.controller.js]
        P3[product.service.js]
        P4[product.repository.js]
        P5[product.validation.js]
      end
      subgraph rentalDir["rental/"]
        R1[rental.routes.js]
        R2[rental.controller.js]
        R3[rental.service.js]
        R4[rental.repository.js]
        R5[rental.validation.js]
      end
      subgraph othersDir["review / wishlist / notification / category / user / recommendation / behavior"]
        OStruct["same 5-file structure"]
      end
    end

    subgraph prismaDir["prisma/"]
      PS[schema.prisma]
      PM["migrations/"]
      PSeed[seed.js]
    end
    subgraph testsDir["tests/"]
      T1[auth.test.js]
      T2[product.test.js]
      T3[rental.test.js]
    end
    App[app.js]
    Server[server.js]
  end
```

---

## 10) Data Flow Diagrams

### Level 0 — Context

```mermaid
flowchart LR
  Renter[[Renter]] -- Browse/Search/Book/Review/Wishlist --> System[AI RENT SYSTEM]
  Owner[[Owner]] -- "List/Manage/Approve" --> System
  Admin[[Admin]] -- "Manage Users/Approve Listings" --> System
  System -- Stats/Notifications --> Owner
  System --- DB[(PostgreSQL)]
  System --- CDN[(Cloudinary / AWS S3)]
  System --- FCM[(Firebase FCM)]
```

### Level 1 — Major Processes

```mermaid
flowchart TB
  R["Renter"]
  subgraph P1["1.0 Authentication"]
    Login["Register/Login - JWT Tokens"]
  end
  subgraph P2[2.0 Product Discovery]
    Search[Search/Browse/Filter/View]
  end
  subgraph P3[3.0 Rental Management]
    Rent[Book/Approve/Cancel/Complete]
  end
  subgraph P4[4.0 Review Management]
    Rev[Rate/Comment/Reply]
  end
  subgraph P5[5.0 AI Recommendation]
    Recs[Track Behavior/Generate Recs]
  end
  subgraph P6[6.0 Notification]
    Notif[Push/Email Alerts]
  end

  D1[(D1: Users)]
  D2[(D2: Products)]
  D3[(D3: Rentals)]
  D4[(D4: Reviews)]
  D5[("D5: Behaviors and Recommendations")]
  D6[(D6: Notifications)]

  R --> P1 --> D1
  R --> P2 --> D2
  P3 --> D3
  P4 --> D4
  P5 --> D5
  P6 --> D6
```

---

