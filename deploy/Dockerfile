# 构建阶段 (编译 Vite 前端)
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# 运行阶段 (轻量 Node 20 Alpine，零外部依赖，集成 Web 托管与极空间同步中枢)
FROM node:20-alpine
WORKDIR /app

# 复制前端编译产物与纯原生 Node 同步服务端代码
COPY --from=builder /app/dist /app/dist
COPY server /app/server
COPY package.json /app/package.json

# 设置环境变量与持久化目录
ENV NODE_ENV=production
ENV PORT=8088
ENV DATA_DIR=/app/data
ENV STATIC_DIR=/app/dist
ENV REQUIRE_HTTPS=false
ENV CORS_ORIGIN=http://localhost:3000

# 数据卷挂载点 (极空间 NAS 映射目录)
VOLUME ["/app/data"]

EXPOSE 8088

# 启动极空间轻量同步与托管服务
CMD ["node", "server/index.js"]
