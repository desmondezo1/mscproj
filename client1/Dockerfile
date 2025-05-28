# Development Dockerfile for React/Vite client
FROM node:20-slim

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Clear any existing installations and install fresh
RUN rm -rf node_modules package-lock.json || true
RUN npm cache clean --force
RUN npm install

# Copy the rest of the application
COPY . .

# Expose Vite's development server port
EXPOSE 5173

# Start the development server with host binding for Docker
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]