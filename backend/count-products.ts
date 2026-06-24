import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { URL } from 'url';

dotenv.config();
const uri = process.env.DATABASE_URL || 'mysql://root:root@127.0.0.1:3306/pharmacy_pos';

async function run() {
    try {
        const dbUrl = new URL(uri);
        const config = {
            host: dbUrl.hostname,
            port: dbUrl.port ? parseInt(dbUrl.port) : 3306,
            user: dbUrl.username,
            password: decodeURIComponent(dbUrl.password),
            database: dbUrl.pathname.replace(/^\//, ''),
            ssl: { rejectUnauthorized: false }
        };
        const pool = mysql.createPool(config);

        const [rows] = await pool.query('SELECT COUNT(*) as count FROM Products');
        console.log(`Total Products: ${(rows as any)[0].count}`);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
