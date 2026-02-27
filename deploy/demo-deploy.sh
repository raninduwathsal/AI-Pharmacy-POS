#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[1/8] Installing dependencies"
npm --prefix "$ROOT_DIR/backend" install
npm --prefix "$ROOT_DIR/backend_customer" install
npm --prefix "$ROOT_DIR/frontend" install
npm --prefix "$ROOT_DIR/frontend_customer" install

echo "[2/8] Ensuring MySQL container exists and is running"
if ! docker ps -a --format '{{.Names}}' | grep -q '^pharmacy-mysql$'; then
  docker run -d --name pharmacy-mysql \
    -e MYSQL_ROOT_PASSWORD=root \
    -e MYSQL_DATABASE=pharmacy_pos \
    -p 3306:3306 \
    mysql:5.7
fi

if ! docker ps --format '{{.Names}}' | grep -q '^pharmacy-mysql$'; then
  docker start pharmacy-mysql
fi

echo "[3/8] Waiting for MySQL readiness"
until docker exec pharmacy-mysql mysqladmin ping -h localhost --silent; do
  sleep 2
done

echo "[4/8] Seeding main backend database"
(
  cd "$ROOT_DIR/backend"
  npx tsx src/seed.ts
)

echo "[5/8] Initializing customer backend database"
(
  cd "$ROOT_DIR/backend_customer"
  docker exec -i pharmacy-mysql mysql -uroot -proot < src/schema.sql
  npx tsx src/seed.ts
)

echo "[6/8] Building frontends"
(
  cd "$ROOT_DIR/frontend"
  VITE_API_URL=/api npm run build
)
(
  cd "$ROOT_DIR/frontend_customer"
  VITE_API_URL=/api npm run build
)

echo "[7/8] Starting backends with PM2"
if ! command -v pm2 >/dev/null 2>&1; then
  echo "PM2 not found. Install it with: sudo npm install -g pm2"
  exit 1
fi

pm2 start "$ROOT_DIR/deploy/ecosystem.config.cjs" --update-env
pm2 save

echo "[8/8] Deployment build complete"
echo "Next: configure Nginx using deploy/nginx/pharmacy-demo.conf and reload nginx."
echo "Main frontend: http://<VPS_IP>"
echo "Customer frontend: http://<VPS_IP>:8080"
