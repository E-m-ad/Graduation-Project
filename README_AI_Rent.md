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
