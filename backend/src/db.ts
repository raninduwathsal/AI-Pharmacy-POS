import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { URL } from 'url';
dotenv.config();

const uri = process.env.DATABASE_URL || 'mysql://root:root@127.0.0.1:3306/pharmacy_pos';

let pool: mysql.Pool;

try {
    const dbUrl = new URL(uri);
    const isLocal = dbUrl.hostname === 'localhost' || dbUrl.hostname === '127.0.0.1';
    
    const config: mysql.PoolOptions = {
        host: dbUrl.hostname,
        port: dbUrl.port ? parseInt(dbUrl.port) : 3306,
        user: dbUrl.username,
        password: decodeURIComponent(dbUrl.password),
        database: dbUrl.pathname.replace(/^\//, ''),
        ssl: isLocal ? undefined : {
            rejectUnauthorized: false
        }
    };
    
    pool = mysql.createPool(config);
} catch (err) {
    // Fallback if URL parsing fails
    pool = mysql.createPool(uri);
}

export default pool;
