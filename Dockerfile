FROM node:20-alpine

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++ tzdata

WORKDIR /app

# Build arguments for version info
ARG GIT_COMMIT=unknown
ARG GIT_COMMIT_FULL=unknown

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY . .

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV DB_PATH=/app/data/quiz.db
ENV GIT_COMMIT=$GIT_COMMIT
ENV GIT_COMMIT_FULL=$GIT_COMMIT_FULL

# Start server
CMD ["npm", "start"]
