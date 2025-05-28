FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Create directory for certificates
RUN mkdir -p certs

# Expose port
EXPOSE 5001

# Start the server
CMD ["npm", "start"]