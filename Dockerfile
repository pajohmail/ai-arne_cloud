FROM node:20-slim

# Create app directory
WORKDIR /usr/src/app

# Install OS deps
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy all sources (ensures package*.json exist)
COPY . .

# Install all deps (including dev for build), build, then prune
RUN npm install && npm run build && npm prune --production

# Expose port
ENV PORT=8080

# Command: run functions framework
CMD ["npx", "@google-cloud/functions-framework", "--target=managerHandler", "--port=8080"]
