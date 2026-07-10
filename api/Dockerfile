# Huy Locket API — production
FROM node:20-alpine

WORKDIR /usr/src/app

# FFmpeg cho media (nếu module cần)
RUN apk add --no-cache ffmpeg python3 make g++

COPY package.json package-lock.json ./
ENV NODE_ENV=production
RUN npm ci --omit=dev || npm install --omit=dev

COPY . .

# Railway / Render set PORT
ENV PORT=5007
EXPOSE 5007

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/health || exit 1

CMD ["node", "app.js"]
