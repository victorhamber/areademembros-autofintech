FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy application source
COPY . .

# Generate Prisma Database Client
RUN npx prisma generate

# Build the React Frontend into /dist
RUN npm run build

# Expose Express server port
EXPOSE 3000

# Start the Node Express Server
CMD ["npm", "run", "server"]
