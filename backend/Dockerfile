FROM node:20-slim

WORKDIR /app

# python3/make/g++ cần để build better-sqlite3 (native module) lúc npm install
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Thư mục lưu SQLite + ảnh món ăn — mount volume vào đây (xem docker-compose.yml)
# để dữ liệu không mất khi container bị xóa hoặc build lại image mới
RUN mkdir -p /app/data/uploads
ENV DB_PATH=/app/data/menu.db
ENV UPLOAD_DIR=/app/data/uploads

EXPOSE 3000
CMD ["node", "server.js"]
