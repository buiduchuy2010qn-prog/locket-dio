# Locket Dio — SPA + CORS API proxy (Render Web Service)
FROM node:20-alpine
WORKDIR /app

# Cần package Neon để lưu OAuth Drive bền (không mất khi redeploy)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY public ./public
COPY server.mjs ./server.mjs

ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000

CMD ["node", "server.mjs"]
