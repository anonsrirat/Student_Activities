FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better caching)
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy app source
COPY . .

# Create directories for uploads and ensure permissions
RUN mkdir -p uploads && chmod -R 755 uploads

EXPOSE 3000

# Healthcheck for Coolify
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/login || exit 1

CMD ["node", "server.js"]
