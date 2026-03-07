FROM node:20-alpine
RUN apk add --no-cache openssl

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./

# Install ALL deps including devDeps so vite is available for the build step
RUN npm ci && npm cache clean --force

COPY . .

# Build the app (requires vite from devDeps)
RUN npm run build

# Remove devDeps after build to keep the image lean
RUN npm prune --omit=dev

CMD ["npm", "run", "docker-start"]
