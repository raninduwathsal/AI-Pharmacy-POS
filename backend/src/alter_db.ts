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
    }
    
    try {
        await pool.query('ALTER TABLE Sale_Items ADD COLUMN product_id INT;');
        await pool.query('ALTER TABLE Sale_Items ADD CONSTRAINT fk_product FOREIGN KEY (product_id) REFERENCES Products(product_id) ON DELETE RESTRICT;');
        await pool.query("ALTER TABLE Sale_Items ADD COLUMN item_type VARCHAR(50) DEFAULT 'otc';");
        await pool.query('ALTER TABLE Sale_Items ADD COLUMN frequency VARCHAR(50);');
        console.log('Successfully added product_id, item_type, and frequency to Sale_Items table.');
    } catch (e: any) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log('Sale_Items columns already exist.');
        } else {
            console.error('Error altering Sale_Items:', e);
        }
    } finally {
        process.exit(0);
    }
}
run();
