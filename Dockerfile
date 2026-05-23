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

# Migração rápida no boot; depois sobe a API sem bloquear com db push pesado
CMD ["sh", "-c", "npx prisma migrate deploy || npx prisma db push --accept-data-loss; exec npm run start"]
