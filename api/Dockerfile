# Huy Locket API — production
FROM node:20-alpine

WORKDIR /usr/src/app

# FFmpeg + wget (health)
RUN apk add --no-cache ffmpeg python3 make g++ wget

COPY package.json package-lock.json ./
ENV NODE_ENV=production
RUN npm ci --omit=dev || npm install --omit=dev

COPY . .

# Render sets PORT (thường 10000)
ENV PORT=10000
EXPOSE 10000

CMD ["node", "app.js"]
