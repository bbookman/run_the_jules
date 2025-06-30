# Dockerfile for Lifeboard Backend

FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
# We will copy src/backend into src/ in the container
COPY src/backend/ ./src/
# If there are shared utils outside src/backend that server.js needs, adjust this
# COPY utils/ ./utils/
COPY public/ ./public/

# Create logs directory
RUN mkdir -p logs

# Expose port
EXPOSE 3000

# Health check (optional, but good practice)
# Update the health check path if your app has a specific health endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["npm", "start"]
