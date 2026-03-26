# Stage 1: Build the React Application
FROM node:22-alpine AS build

WORKDIR /app

# Install dependencies first for Docker caching
COPY package*.json ./
RUN npm install

# Copy all the source code
COPY . .

# Build the Vite application
RUN npm run build

# Stage 2: Serve the Built Application with NGINX
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets from builder stage
COPY --from=build /app/dist /usr/share/nginx/html

# Replace default NGINX configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port (Easypanel dynamically maps this)
EXPOSE 80

# Start NGINX
CMD ["nginx", "-g", "daemon off;"]
