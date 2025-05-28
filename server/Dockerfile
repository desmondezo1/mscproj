# Production-ready Node.js server
FROM node:20-slim

# Create app directory
WORKDIR /usr/src/app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create directories that might be needed
RUN mkdir -p certs logs

# Create a non-root user for security
RUN groupadd -r nodeuser && useradd -r -g nodeuser nodeuser
RUN chown -R nodeuser:nodeuser /usr/src/app
USER nodeuser

# Expose the port (matching your app.js)
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Start the server
CMD ["npm", "start"]