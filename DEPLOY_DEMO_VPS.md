# Demo VPS Deployment (2 Frontends + 2 Backends)

This setup exposes:
- Main POS app: `http://YOUR_VPS_IP`
- Customer app: `http://YOUR_VPS_IP:8080`

It is for demo use (no SSL/hardening).

## Quick path (automated)

After installing prerequisites (`node`, `npm`, `docker`, `mysql-client`, `pm2`) you can run:

```bash
cd /home/rani/AI-Pharmacy-POS
./deploy/demo-deploy.sh
```

Then apply Nginx config in step 7.

## 1) Install system packages

```bash
sudo apt update
sudo apt install -y nginx
```

`mysql-client` on host is optional because schema import can run through the MySQL Docker container.

Install Node 20 (if needed):

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

Install PM2:

```bash
sudo npm install -g pm2
```

## 2) Ensure MySQL container is running

```bash
docker ps -a | grep pharmacy-mysql || docker run -d --name pharmacy-mysql \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=pharmacy_pos \
  -p 3306:3306 \
  mysql:5.7

docker ps | grep pharmacy-mysql || docker start pharmacy-mysql
```

Optional: wait until DB is ready.

```bash
until docker exec pharmacy-mysql mysqladmin ping -h localhost --silent; do sleep 2; done
```

## 3) Install app dependencies

From repo root:

```bash
cd /home/rani/AI-Pharmacy-POS
npm --prefix backend install
npm --prefix backend_customer install
npm --prefix frontend install
npm --prefix frontend_customer install
```

## 4) Prepare databases

Main backend seed:

```bash
cd /home/rani/AI-Pharmacy-POS/backend
npx tsx src/seed.ts
```

Customer backend schema + seed:

```bash
cd /home/rani/AI-Pharmacy-POS/backend_customer
docker exec -i pharmacy-mysql mysql -uroot -proot < src/schema.sql
npx ts-node src/seed.ts
```

## 5) Build both frontends

```bash
cd /home/rani/AI-Pharmacy-POS/frontend
VITE_API_URL=/api npm run build

cd /home/rani/AI-Pharmacy-POS/frontend_customer
VITE_API_URL=/api npm run build
```

## 6) Start both backends with PM2

```bash
cd /home/rani/AI-Pharmacy-POS
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup
```

To check status/logs:

```bash
pm2 status
pm2 logs pharmacy-backend --lines 100
pm2 logs pharmacy-customer-backend --lines 100
```

## 7) Configure Nginx

```bash
sudo cp /home/rani/AI-Pharmacy-POS/deploy/nginx/pharmacy-demo.conf /etc/nginx/sites-available/pharmacy-demo
sudo ln -sf /etc/nginx/sites-available/pharmacy-demo /etc/nginx/sites-enabled/pharmacy-demo
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## 8) Open firewall ports

If UFW is enabled:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 8080/tcp
sudo ufw reload
```

## 9) Verify

- Main app: `http://YOUR_VPS_IP`
- Customer app: `http://YOUR_VPS_IP:8080`
- Main backend health: `http://YOUR_VPS_IP/api/health`

## Common demo commands

Rebuild/redeploy frontends after changes:

```bash
cd /home/rani/AI-Pharmacy-POS/frontend && VITE_API_URL=/api npm run build
cd /home/rani/AI-Pharmacy-POS/frontend_customer && VITE_API_URL=/api npm run build
sudo systemctl reload nginx
```

Restart backend services:

```bash
cd /home/rani/AI-Pharmacy-POS
pm2 restart pharmacy-backend pharmacy-customer-backend
```
