const path = require('path');
const repoRoot = path.resolve(__dirname, '..');

module.exports = {
  apps: [
    {
      name: 'pharmacy-backend',
      cwd: path.join(repoRoot, 'backend'),
      script: 'npx',
      args: 'tsx src/server.ts',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        DATABASE_URL: 'mysql://root:root@127.0.0.1:3306/pharmacy_pos'
      }
    },
    {
      name: 'pharmacy-customer-backend',
      cwd: path.join(repoRoot, 'backend_customer'),
      script: 'npx',
      args: 'tsx src/index.ts',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        DB_HOST: '127.0.0.1',
        DB_PORT: 3306,
        DB_USER: 'root',
        DB_PASSWORD: 'root',
        DB_NAME: 'pharmacy_customer_db',
        POS_BACKEND_URL: 'http://127.0.0.1:5000'
      }
    }
  ]
};
