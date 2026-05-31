# ==========================================
# OMNITRACK BACKEND SERVICE CONTAINER
# ==========================================
FROM node:20-alpine

WORKDIR /app

# Install native compilation dependencies for SQLite on Alpine
RUN apk add --no-cache python3 make g++ gcc build-base

# Copy dependency manifests
COPY package*.json ./

# Clean install packages
RUN npm install

# Copy server code
COPY . .

# Expose backend REST port
EXPOSE 5001

# Start Express server
CMD ["node", "server.js"]
