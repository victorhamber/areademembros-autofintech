FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy application source
COPY . .

# Generate Prisma Database Client
RUN apk add --no-cache openssl
RUN npx prisma generate

# Build the React Frontend into /dist
RUN npm run build

# Ponto de montagem para uploads persistentes (volume EasyPanel → /app/uploads ou UPLOAD_DIR)
RUN mkdir -p /app/uploads /data/uploads && chmod 755 /app/uploads /data/uploads

# Expose Express server port
EXPOSE 3000

# Migração no boot via script: trata P3005 (baseline automático) antes do fallback db push.
CMD ["sh", "-c", "sh scripts/db-boot.sh; exec npm run start"]
