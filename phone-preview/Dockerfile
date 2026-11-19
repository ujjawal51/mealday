FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY server ./server
COPY dist ./dist
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
USER node
EXPOSE 3000
CMD ["node", "server/index.mjs"]
