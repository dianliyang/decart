# ==========================================
# OMNITRACK BACKEND SERVICE CONTAINER
# ==========================================
FROM node:20-alpine

WORKDIR /app

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
