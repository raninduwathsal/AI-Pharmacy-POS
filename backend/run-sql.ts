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

        console.log('Applying Employee_Read_Alerts table schema...');
        await pool.query(`
        CREATE TABLE IF NOT EXISTS Employee_Read_Alerts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            emp_id INT NOT NULL,
            alert_id VARCHAR(100) NOT NULL,
            message TEXT NOT NULL,
            read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (emp_id, alert_id),
            FOREIGN KEY (emp_id) REFERENCES Employee(emp_id) ON DELETE CASCADE
        );`);
        console.log('Done!');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
