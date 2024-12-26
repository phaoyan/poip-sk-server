# 使用官方的 Node.js 镜像作为基础镜像
FROM node:18-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制后端项目文件
COPY package*.json yarn.lock* ./

# 安装后端依赖
RUN if [ -f "yarn.lock" ]; then yarn install --frozen-lockfile; else npm install --production; fi

# 复制后端源代码
COPY . .

# 构建后端 (如果使用 TypeScript)
RUN npm run build

# 切换到 client 目录
WORKDIR /app/client

# 复制前端项目文件
COPY client/package*.json client/yarn.lock* ./

# 安装前端依赖
RUN if [ -f "yarn.lock" ]; then yarn install --frozen-lockfile; else npm install; fi

# 构建前端应用
RUN npm run build

# --- 第二阶段：运行镜像 ---
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制后端项目文件和已安装的依赖 (仅生产环境依赖)
COPY package*.json yarn.lock* ./
RUN if [ -f "yarn.lock" ]; then yarn install --production --frozen-lockfile; else npm install --production; fi
COPY --from=builder /app/dist ./dist
COPY index.ts .

# 复制构建好的前端静态文件
COPY --from=builder /app/client/dist ./client/dist

# 暴露你的 Node.js 服务端口
EXPOSE 3000 

# 定义启动命令
CMD ["node", "dist/index.js"] # 假设 TypeScript 编译后输出到 dist 目录
# 如果你没有编译 TypeScript，并且直接运行 index.ts，则使用：
# CMD ["node", "index.ts"] # 注意：生产环境通常建议先编译