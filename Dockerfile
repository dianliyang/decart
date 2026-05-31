# ==========================================
# STAGE 1: Sandbox Builder Environment
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Clean-install dependencies using locks
RUN npm ci

# Copy full application codebase
COPY . .

# Compile TypeScript and bundle assets
RUN npm run build

# ==========================================
# STAGE 2: Lightweight Production Server
# ==========================================
FROM nginx:alpine

# Copy compiled assets from builder stage to Nginx web directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Replace default Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose HTTP port
EXPOSE 80

# Run Nginx in foreground mode
CMD ["nginx", "-g", "daemon off;"]
