import pool from './db';

async function run() {
    try {
        await pool.query('ALTER TABLE Products ADD COLUMN unit_cost DECIMAL(10,2) DEFAULT 0.00;');
        await pool.query('ALTER TABLE Products ADD COLUMN location VARCHAR(100);');
        console.log('Successfully added unit_cost and location to Products table.');
    } catch (e: any) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log('Columns already exist.');
        } else {
            console.error('Error:', e);
        }
    } finally {
        process.exit(0);
    }
}
run();
