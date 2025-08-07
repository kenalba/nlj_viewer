# Frontend Dockerfile for NLJ Platform
# Multi-stage build for development and production

# Development stage
FROM node:20-alpine AS development
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Clear any cached dependencies to avoid optimization issues
RUN rm -rf node_modules/.vite

# Expose development port
EXPOSE 5173

# Start development server with force dependency re-optimization
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--force"]

# Build stage - for now, use pre-built files
FROM node:20-alpine AS build
WORKDIR /app

# Copy pre-built dist directory (temporary solution)
COPY dist/ ./dist/

# Production stage with nginx
FROM nginx:alpine AS production

# Install curl for health checks
RUN apk add --no-cache curl

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]