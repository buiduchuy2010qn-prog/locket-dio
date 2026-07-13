# Huy Locket — SPA + CORS API proxy
# Deploy: Render / Fly.io / Railway (public/ + server.mjs)
FROM node:20-alpine
WORKDIR /app

# Neon optional — Drive OAuth bền
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY public ./public
COPY server.mjs ./server.mjs

ENV NODE_ENV=production
# Render/Fly/Railway inject PORT; fallback 10000
ENV PORT=10000
EXPOSE 10000

CMD ["node", "server.mjs"]
