# Dockerfile for Lifeboard Frontend (React)

# Stage 1: Build the React application
FROM node:18-alpine AS build

WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve the static files with a lightweight server (e.g., Nginx)
FROM nginx:stable-alpine

# Copy the build output from the build stage
COPY --from=build /app/build /usr/share/nginx/html

# Expose port 80 (default for Nginx)
EXPOSE 80

# Command to run Nginx
CMD ["nginx", "-g", "daemon off;"]
