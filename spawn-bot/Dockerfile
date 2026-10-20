FROM oven/bun:latest
WORKDIR /app
COPY package.json ./
RUN bun install --production
COPY companion.js play.js ./
ENV NODE_ENV=production
EXPOSE 10000
CMD ["bun", "companion.js"]
