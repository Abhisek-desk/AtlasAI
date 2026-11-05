FROM node:22

WORKDIR /app

# Root package (ioredis, used by ./shared). It has no lockfile.
COPY package*.json ./
RUN npm install

# Dependencies for each service (cached until a package.json changes)
COPY gateway/package*.json ./gateway/
RUN cd gateway && npm ci

COPY services/auth/package*.json ./services/auth/
RUN cd services/auth && npm ci

COPY services/chat/package*.json ./services/chat/
RUN cd services/chat && npm ci

COPY services/agent/package*.json ./services/agent/
RUN cd services/agent && npm ci

COPY services/billing/package*.json ./services/billing/
RUN cd services/billing && npm ci

# Source code
COPY shared ./shared
COPY gateway ./gateway
COPY services ./services
COPY start-all.mjs ./

ENV NODE_ENV=production

# Render sets PORT; the launcher gives it to the gateway.
EXPOSE 10000

CMD ["node", "start-all.mjs"]