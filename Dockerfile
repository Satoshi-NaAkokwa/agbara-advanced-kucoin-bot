FROM node:18-alpine

# Install dependencies
RUN apk add --no-cache git curl

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create logs directory
RUN mkdir -p logs

# Create non-root user
RUN addgroup -g 1001 -S agbara && \
    adduser -S -u 1001 -G agbara agbara && \
    chown -R agbara:agbara /app

# Switch to non-root user
USER agbara

# Expose health check port (optional)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('fs').statSync('logs/bot.log').mtime.getTime() > Date.now() - 120000" || exit 1

# Start the bot
CMD ["node", "index.js"]