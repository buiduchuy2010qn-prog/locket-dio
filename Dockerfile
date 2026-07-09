# Locket Dio — SPA + CORS API proxy (Render Web Service)
FROM node:20-alpine
WORKDIR /app

# Only need runtime files (prebuilt public/ + proxy)
COPY public ./public
COPY server.mjs ./server.mjs

ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000

CMD ["node", "server.mjs"]
