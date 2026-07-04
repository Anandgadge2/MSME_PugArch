# Use official Node.js runtime as parent image
FROM node:24-alpine AS builder

WORKDIR /usr/src/app

# Copy package.json
COPY package.json ./

# Install dependencies (including devDependencies for building)
RUN npm install

# Copy Prisma schema
COPY prisma ./prisma/

# Generate Prisma Client
RUN npx prisma generate

# Copy source code and config files
COPY tsconfig*.json ./
COPY index.ts ./
COPY prisma.config.ts ./
COPY src ./src/

# Compile TypeScript
RUN npm run build

# --- Production Runner Stage ---
FROM node:24-alpine AS runner

WORKDIR /usr/src/app

# Set node environment to production
ENV NODE_ENV=production

# Copy package.json
COPY package.json ./

# Install production-only dependencies
RUN npm install --omit=dev

# Copy generated Prisma Client and binary from builder
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /usr/src/app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /usr/src/app/prisma ./prisma

# Copy compiled application code from builder
COPY --from=builder /usr/src/app/dist ./dist

# Cloud Run defaults to port 8080
EXPOSE 8080
ENV PORT=8080

# Run the app
CMD ["npm", "start"]
