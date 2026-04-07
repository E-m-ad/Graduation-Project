# Server Deployment

This backend is now prepared for Docker-based deployment.

## Required environment variables

Use `.env.example` as the template.

- `DATABASE_URL`: PostgreSQL connection string for the running app
- `JWT_SECRET`: access token signing secret
- `REFRESH_TOKEN_SECRET`: refresh token signing secret
- `ACCESS_TOKEN_EXPIRATION`
- `REFRESH_TOKEN_EXPIRATION`
- `APP_BASE_URL`: public HTTPS URL of the deployed app

If you later want a separate connection string for Prisma CLI commands such as migrations, you can add that back explicitly.

## Build the image

```bash
docker build -t ai-rent-server .
```

## Run the container

```bash
docker run --env-file .env -p 3000:3000 ai-rent-server
```

## Health check

The server exposes:

```text
GET /healthz
```

It returns `200` when the API can reach the database, and `503` when the API is up but the database check fails.

## Production notes

- The API trusts one reverse proxy hop, which is the common setup on managed hosts.
- Frontend assets are built into the image during `docker build`.
- Uploaded files currently live under `uploads/` inside the container filesystem.
- For real production, use persistent disk storage or move uploads to object storage such as Cloudinary or S3.
