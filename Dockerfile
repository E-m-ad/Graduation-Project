FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/src ./src
COPY --from=build /app/frontend/dist ./frontend/dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.js ./prisma.config.js
RUN mkdir -p uploads/products uploads/avatars
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/healthz" > /dev/null || exit 1
CMD ["node", "src/app.js"]
