FROM node:22-slim
ENV NODE_ENV=production TZ=UTC
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY db ./db
COPY web ./web
USER node
EXPOSE 3000
CMD ["npx", "tsx", "src/index.ts"]
